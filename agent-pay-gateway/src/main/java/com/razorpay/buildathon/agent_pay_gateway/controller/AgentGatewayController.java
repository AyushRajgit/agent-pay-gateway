package com.razorpay.buildathon.agent_pay_gateway.controller;

import com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects.*;
import com.razorpay.buildathon.agent_pay_gateway.model.AuditLog;
import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import com.razorpay.buildathon.agent_pay_gateway.repository.AuditLogRepository;
import com.razorpay.buildathon.agent_pay_gateway.service.AgentStoreService;
import com.razorpay.buildathon.agent_pay_gateway.service.CheckoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AgentGatewayController {

    private final CheckoutService checkoutService;
    private final AgentStoreService agentStoreService;
    private final AuditLogRepository auditLogRepository;

    @PostMapping("/execute_checkout")
    public ResponseEntity<String> executeSecureCheckout(@RequestBody CheckoutRequest request) {
        try {
            // secure, locked, transactional method
            String result = checkoutService.executeCheckout(request.getSkuList(), request.getAgentBudgetMandate());
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

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