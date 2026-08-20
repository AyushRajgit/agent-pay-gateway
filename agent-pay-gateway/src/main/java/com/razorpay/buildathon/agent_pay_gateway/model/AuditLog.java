package com.razorpay.buildathon.agent_pay_gateway.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String agentId;
    private String intentAction;
    private BigDecimal requestedAmount;
    private BigDecimal mandateLimit;

    private String status;
    private String razorpayOrderId;

    @Column(length = 1000)
    private String explanation;

    private LocalDateTime timestamp;

    @PrePersist
    public void prePersist() {
        this.timestamp = LocalDateTime.now();
    }
}