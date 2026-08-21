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
public class UpsellResponse {
    private String primarySku;
    private String primaryName;
    private BigDecimal primaryPrice;

    private String upsellSku;
    private String upsellName;
    private BigDecimal upsellPrice;

    private BigDecimal totalCartPrice;
    private boolean fitsMandate;
    private String pitchMessage;
}