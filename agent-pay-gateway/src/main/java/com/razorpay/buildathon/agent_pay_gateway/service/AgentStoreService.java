package com.razorpay.buildathon.agent_pay_gateway.service;

import com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects.*;
import com.razorpay.buildathon.agent_pay_gateway.model.AuditLog;
import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import com.razorpay.buildathon.agent_pay_gateway.repository.AuditLogRepository;
import com.razorpay.buildathon.agent_pay_gateway.repository.ProductRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import lombok.RequiredArgsConstructor;
import org.json.JSONObject;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AgentStoreService {

    private final ProductRepository productRepository;
    private final AuditLogRepository auditLogRepository;
    private final RazorpayClient razorpayClient;

    public List<Product> getCatalog() {
        return productRepository.findAll();
    }

    public UpsellResponse evaluateUpsell(UpsellRequest request) {
        Product primary = productRepository.findBySku(request.getSku())
                .orElseThrow(() -> new RuntimeException("Product not found: " + request.getSku()));

        // Find any accessory that isn't the primary item
        Product upsellItem = productRepository.findAll().stream()
                .filter(p -> "Accessories".equalsIgnoreCase(p.getCategory()) && !p.getSku().equals(primary.getSku()))
                .findFirst()
                .orElse(null);

        BigDecimal total = primary.getPrice();
        boolean fits = true;
        String upsellSku = null;
        String upsellName = null;
        BigDecimal upsellPrice = BigDecimal.ZERO;

        if (upsellItem != null) {
            BigDecimal combined = primary.getPrice().add(upsellItem.getPrice());
            // Check against dynamic mandate limit
            if (request.getAgentBudgetMandate() == null || combined.compareTo(request.getAgentBudgetMandate()) <= 0) {
                total = combined;
                upsellSku = upsellItem.getSku();
                upsellName = upsellItem.getName();
                upsellPrice = upsellItem.getPrice();
            } else {
                fits = false;
            }
        }

        return UpsellResponse.builder()
                .primarySku(primary.getSku())
                .primaryName(primary.getName())
                .primaryPrice(primary.getPrice())
                .upsellSku(upsellSku)
                .upsellName(upsellName)
                .upsellPrice(upsellPrice)
                .totalCartPrice(total)
                .fitsMandate(fits)
                .pitchMessage(upsellSku != null ? "Bundle discount applicable: Added " + upsellName + " within your spending limit." : "No upsell fits budget.")
                .build();
    }

    public CheckoutResponse processCheckout(CheckoutRequest request) {
        List<Product> items = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (String sku : request.getSkuList()) {
            Product product = productRepository.findBySku(sku)
                    .orElseThrow(() -> new RuntimeException("Item not found: " + sku));
            items.add(product);
            totalAmount = totalAmount.add(product.getPrice());
        }

        if (request.getAgentBudgetMandate() != null && totalAmount.compareTo(request.getAgentBudgetMandate()) > 0) {
            auditLogRepository.save(AuditLog.builder()
                    .agentId(request.getAgentId())
                    .intentAction("PURCHASE_ATTEMPT")
                    .requestedAmount(totalAmount)
                    .mandateLimit(request.getAgentBudgetMandate())
                    .status("BLOCKED_BY_POLICY")
                    .explanation("Total amount ₹" + totalAmount + " exceeded mandate cap of ₹" + request.getAgentBudgetMandate())
                    .build());

            return CheckoutResponse.builder()
                    .status("BLOCKED_BY_POLICY")
                    .finalAmount(totalAmount)
                    .currency("INR")
                    .message("Order rejected: Total exceeds agent spending mandate limit.")
                    .build();
        }

        try {
            JSONObject orderRequest = new JSONObject();
            orderRequest.put("amount", totalAmount.multiply(new BigDecimal("100")).intValue());
            orderRequest.put("currency", "INR");
            orderRequest.put("receipt", "rcpt_" + System.currentTimeMillis());

            Order order = razorpayClient.orders.create(orderRequest);
            String rzpOrderId = order.get("id");

            auditLogRepository.save(AuditLog.builder()
                    .agentId(request.getAgentId())
                    .intentAction("PURCHASE_ATTEMPT")
                    .requestedAmount(totalAmount)
                    .mandateLimit(request.getAgentBudgetMandate())
                    .status("APPROVED")
                    .razorpayOrderId(rzpOrderId)
                    .explanation("Authorized within mandate limits. Razorpay Order generated.")
                    .build());

            return CheckoutResponse.builder()
                    .status("APPROVED")
                    .razorpayOrderId(rzpOrderId)
                    .finalAmount(totalAmount)
                    .currency("INR")
                    .message("Payment order successfully created on Razorpay rails.")
                    .build();

        } catch (Exception e) {
            auditLogRepository.save(AuditLog.builder()
                    .agentId(request.getAgentId())
                    .intentAction("PURCHASE_ATTEMPT")
                    .requestedAmount(totalAmount)
                    .mandateLimit(request.getAgentBudgetMandate())
                    .status("FAILED")
                    .explanation("Razorpay Gateway Exception: " + e.getMessage())
                    .build());

            throw new RuntimeException("Failed to initiate Razorpay order: " + e.getMessage());
        }
    }
}