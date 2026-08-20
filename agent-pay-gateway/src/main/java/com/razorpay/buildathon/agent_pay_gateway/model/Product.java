package com.razorpay.buildathon.agent_pay_gateway.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sku;
    private String name;
    private String category;
    private BigDecimal price;
    private Integer stock;

    @Column(length = 1000)
    private String agentMetadata;
}