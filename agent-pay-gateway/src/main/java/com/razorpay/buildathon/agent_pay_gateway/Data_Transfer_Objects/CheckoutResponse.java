package com.razorpay.buildathon.agent_pay_gateway.Data_Transfer_Objects;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutResponse {
    private String status;
    private String razorpayOrderId;
    private BigDecimal finalAmount;
    private String currency;
    private String message;
}