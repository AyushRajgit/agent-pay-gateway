package com.razorpay.buildathon.agent_pay_gateway.service;

import com.razorpay.buildathon.agent_pay_gateway.model.Product;
import com.razorpay.buildathon.agent_pay_gateway.repository.ProductRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class CheckoutService {

    private final ProductRepository productRepository;

    public CheckoutService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Transactional
    public String executeCheckout(List<String> skuList, BigDecimal mandateLimit) {
        BigDecimal totalCost = BigDecimal.ZERO;
        List<Product> cart = new ArrayList<>();

        for (String sku : skuList) {
            Product product = productRepository.findBySku(sku)
                    .orElseThrow(() -> new RuntimeException("Product not found: " + sku));

            // Check Inventory before doing math
            if (product.getStock() <= 0) {
                throw new RuntimeException("Item " + sku + " is Out of Stock!");
            }

            totalCost = totalCost.add(product.getPrice());
            cart.add(product);
        }

        // Zero-Trust Mandate Check, If totalCost is GREATER THAN mandateLimit
        if (totalCost.compareTo(mandateLimit) > 0) {
            throw new RuntimeException("Cart total (" + totalCost + ") exceeds mandate limit (" + mandateLimit + ")!");
        }

        for (Product product : cart) {
            product.setStock(product.getStock() - 1);
            productRepository.save(product);
        }

        return "SUCCESS: Checkout completed securely.";
    }
}