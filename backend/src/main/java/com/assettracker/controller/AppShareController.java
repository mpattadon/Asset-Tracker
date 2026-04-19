package com.assettracker.controller;

import com.assettracker.service.AppHostingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/app/share")
public class AppShareController {

    private final AppHostingService appHostingService;

    public AppShareController(AppHostingService appHostingService) {
        this.appHostingService = appHostingService;
    }

    @GetMapping("/status")
    public AppHostingService.ShareStatus status() {
        return appHostingService.status();
    }

    @PostMapping("/start")
    public AppHostingService.ShareStatus start() {
        return appHostingService.startSharing();
    }

    @PostMapping("/stop")
    public AppHostingService.ShareStatus stop() {
        return appHostingService.stopSharing();
    }
}
