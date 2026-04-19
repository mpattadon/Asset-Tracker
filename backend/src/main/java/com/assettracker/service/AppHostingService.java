package com.assettracker.service;

import com.assettracker.config.AssetTrackerProperties;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;

@Service
public class AppHostingService {
    private static final Set<String> HOP_BY_HOP_HEADERS = Set.of(
            "connection",
            "content-length",
            "host",
            "http2-settings",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailer",
            "transfer-encoding",
            "upgrade"
    );

    @Autowired
    private AssetTrackerProperties properties;

    @Autowired
    private RuntimeStateRepository runtimeStateRepository;

    @Autowired
    private Environment environment;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private volatile HttpServer privateServer;
    private volatile HttpServer shareServer;
    private volatile int backendPort;

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        Integer localPort = environment.getProperty("local.server.port", Integer.class);
        Integer serverPort = environment.getProperty("server.port", Integer.class);
        backendPort = localPort != null ? localPort : (serverPort != null ? serverPort : 8080);
        runtimeStateRepository.saveAppSetting("app.share.enabled", "false");
        if (properties.appHost().privateEnabled()) {
            privateServer = startServer("127.0.0.1", properties.appHost().privatePort());
        }
    }

    public synchronized ShareStatus startSharing() {
        if (shareServer == null) {
            shareServer = startServer("0.0.0.0", properties.appHost().sharePort());
        }
        runtimeStateRepository.saveAppSetting("app.share.enabled", "true");
        return status();
    }

    public synchronized ShareStatus stopSharing() {
        if (shareServer != null) {
            shareServer.stop(0);
            shareServer = null;
        }
        runtimeStateRepository.saveAppSetting("app.share.enabled", "false");
        return status();
    }

    public ShareStatus status() {
        Integer privatePort = boundPort(privateServer, properties.appHost().privatePort());
        Integer sharePort = boundPort(shareServer, properties.appHost().sharePort());
        return new ShareStatus(
                privateServer != null,
                shareServer != null,
                privateServer == null || privatePort == null ? null : "http://127.0.0.1:" + privatePort + "/",
                shareServer == null || sharePort == null ? null : "http://" + resolveLanAddress() + ":" + sharePort + "/",
                Files.exists(resolveFrontendPath().resolve("index.html"))
        );
    }

    @PreDestroy
    public synchronized void shutdown() {
        if (privateServer != null) {
            privateServer.stop(0);
            privateServer = null;
        }
        if (shareServer != null) {
            shareServer.stop(0);
            shareServer = null;
        }
    }

    private HttpServer startServer(String host, int port) {
        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(host, port), 0);
            server.createContext("/api", this::proxyApi);
            server.createContext("/", new StaticFrontendHandler(resolveFrontendPath()));
            server.setExecutor(Executors.newCachedThreadPool());
            server.start();
            return server;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to start app host on " + host + ":" + port, exception);
        }
    }

    private void proxyApi(HttpExchange exchange) throws IOException {
        byte[] body = readRequestBody(exchange);
        URI backendUri = URI.create("http://127.0.0.1:" + backendPort + exchange.getRequestURI());
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(backendUri)
                .method(exchange.getRequestMethod(), HttpRequest.BodyPublishers.ofByteArray(body))
                .timeout(Duration.ofSeconds(30));

        Set<String> skippedHeaders = hopByHopHeaders(exchange.getRequestHeaders());

        exchange.getRequestHeaders().forEach((name, values) -> {
            if (skippedHeaders.contains(name.toLowerCase(Locale.ROOT))) {
                return;
            }
            values.forEach(value -> requestBuilder.header(name, value));
        });

        try {
            HttpResponse<byte[]> response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofByteArray());
            Headers responseHeaders = exchange.getResponseHeaders();
            Set<String> responseSkippedHeaders = hopByHopHeaders(response.headers().map());
            response.headers().map().forEach((name, values) -> {
                if (responseSkippedHeaders.contains(name.toLowerCase(Locale.ROOT))) {
                    return;
                }
                responseHeaders.put(name, values);
            });
            exchange.sendResponseHeaders(response.statusCode(), response.body().length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(response.body());
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            byte[] payload = "Upstream request interrupted".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(502, payload.length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload);
            }
        } catch (RuntimeException exception) {
            byte[] payload = "Upstream request failed".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(502, payload.length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload);
            }
        } finally {
            exchange.close();
        }
    }

    private byte[] readRequestBody(HttpExchange exchange) throws IOException {
        try (InputStream inputStream = exchange.getRequestBody()) {
            return inputStream.readAllBytes();
        }
    }

    private Path resolveFrontendPath() {
        return Paths.get(properties.appHost().frontendDist()).normalize();
    }

    private Set<String> hopByHopHeaders(Headers headers) {
        return hopByHopHeaders(headers.entrySet().stream()
                .filter(entry -> "connection".equalsIgnoreCase(entry.getKey()))
                .flatMap(entry -> entry.getValue().stream())
                .toList());
    }

    private Set<String> hopByHopHeaders(Map<String, List<String>> headers) {
        return hopByHopHeaders(headers.entrySet().stream()
                .filter(entry -> "connection".equalsIgnoreCase(entry.getKey()))
                .flatMap(entry -> entry.getValue().stream())
                .toList());
    }

    private Set<String> hopByHopHeaders(List<String> connectionHeaderValues) {
        Set<String> headers = new HashSet<>(HOP_BY_HOP_HEADERS);
        connectionHeaderValues.stream()
                .flatMap(value -> List.of(value.split(",")).stream())
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .forEach(headers::add);
        return headers;
    }

    private String resolveLanAddress() {
        try {
            Enumeration<NetworkInterface> networkInterfaces = NetworkInterface.getNetworkInterfaces();
            while (networkInterfaces.hasMoreElements()) {
                NetworkInterface networkInterface = networkInterfaces.nextElement();
                if (!networkInterface.isUp() || networkInterface.isLoopback()) {
                    continue;
                }
                Enumeration<InetAddress> addresses = networkInterface.getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress address = addresses.nextElement();
                    if (address instanceof Inet4Address inet4Address && address.isSiteLocalAddress()) {
                        return inet4Address.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "127.0.0.1";
    }

    private Integer boundPort(HttpServer server, int configuredPort) {
        if (server == null || server.getAddress() == null) {
            return null;
        }
        int actualPort = server.getAddress().getPort();
        return actualPort > 0 ? actualPort : configuredPort;
    }

    public record ShareStatus(boolean privateHostRunning,
                              boolean shareEnabled,
                              String privateUrl,
                              String shareUrl,
                              boolean frontendAvailable) {
    }

    private static final class StaticFrontendHandler implements HttpHandler {
        private final Path frontendRoot;

        private StaticFrontendHandler(Path frontendRoot) {
            this.frontendRoot = frontendRoot;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String requestPath = exchange.getRequestURI().getPath();
            Path requestedFile = frontendRoot.resolve(requestPath.substring(1)).normalize();
            if (requestPath.equals("/") || !Files.exists(requestedFile) || Files.isDirectory(requestedFile)) {
                requestedFile = frontendRoot.resolve("index.html");
            }

            byte[] payload;
            String contentType;
            int status;
            if (Files.exists(requestedFile)) {
                payload = Files.readAllBytes(requestedFile);
                contentType = contentType(requestedFile);
                status = 200;
            } else {
                payload = """
                        <!doctype html>
                        <html lang="en">
                        <head><meta charset="utf-8"><title>Asset Tracker</title></head>
                        <body style="font-family: sans-serif; padding: 24px;">
                          <h1>Frontend build not found</h1>
                          <p>Build the frontend first so the local/share host can serve it.</p>
                        </body>
                        </html>
                        """.getBytes(StandardCharsets.UTF_8);
                contentType = "text/html; charset=utf-8";
                status = 503;
            }

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(status, payload.length);
            try (OutputStream outputStream = exchange.getResponseBody()) {
                outputStream.write(payload);
            } finally {
                exchange.close();
            }
        }

        private String contentType(Path file) {
            String filename = file.getFileName().toString().toLowerCase(Locale.ROOT);
            if (filename.endsWith(".html")) {
                return "text/html; charset=utf-8";
            }
            if (filename.endsWith(".js")) {
                return "application/javascript; charset=utf-8";
            }
            if (filename.endsWith(".css")) {
                return "text/css; charset=utf-8";
            }
            if (filename.endsWith(".svg")) {
                return "image/svg+xml";
            }
            if (filename.endsWith(".json")) {
                return "application/json; charset=utf-8";
            }
            return "application/octet-stream";
        }
    }
}
