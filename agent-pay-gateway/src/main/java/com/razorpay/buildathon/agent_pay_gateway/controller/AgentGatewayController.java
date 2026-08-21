package com.razorpay.buildathon.agent_pay_gateway.controller;

import com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects.*;
import com.razorpay.buildathon.agent_pay_gateway.model.AuditLog;
import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import com.razorpay.buildathon.agent_pay_gateway.repository.AuditLogRepository;
import com.razorpay.buildathon.agent_pay_gateway.service.AgentStoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AgentGatewayController {

    private final AgentStoreService agentStoreService;
    private final AuditLogRepository auditLogRepository;

    @GetMapping("/agent/catalog")
    public ResponseEntity<List<Product>> getCatalog() {
        return ResponseEntity.ok(agentStoreService.getCatalog());
    }

    @PostMapping("/agent/cart/upsell")
    public ResponseEntity<UpsellResponse> evaluateUpsell(@RequestBody UpsellRequest request) {
        return ResponseEntity.ok(agentStoreService.evaluateUpsell(request));
    }

    @PostMapping("/agent/checkout")
    public ResponseEntity<CheckoutResponse> checkout(@RequestBody CheckoutRequest request) {
        return ResponseEntity.ok(agentStoreService.processCheckout(request));
    }

    @GetMapping("/merchant/audit-logs")
    public ResponseEntity<List<AuditLog>> getAuditLogs() {
        return ResponseEntity.ok(auditLogRepository.findAll());
    }
}