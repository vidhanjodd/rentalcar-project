package com.rentalcar.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Adds traceId and requestId to every request's MDC context.
 *
 * Deepak's design — every log line in the same request shares the same
 * traceId, making it trivial to correlate logs across services or find
 * all logs for a specific request in Kibana / CloudWatch Logs Insights.
 *
 * traceId: from X-Trace-Id header if provided (gateway/upstream sets it)
 *          otherwise a new UUID is generated for this request.
 * requestId: always a fresh UUID per request.
 *
 * Both are also written to response headers so clients can reference them.
 */
@Component
public class RequestTraceFilter extends OncePerRequestFilter {

    private static final String TRACE_ID_HEADER   = "X-Trace-Id";
    private static final String REQUEST_ID_HEADER  = "X-Request-Id";
    private static final String MDC_TRACE_ID       = "traceId";
    private static final String MDC_REQUEST_ID     = "requestId";

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String traceId   = getOrGenerate(request, TRACE_ID_HEADER);
        String requestId = UUID.randomUUID().toString();

        MDC.put(MDC_TRACE_ID,   traceId);
        MDC.put(MDC_REQUEST_ID, requestId);

        response.setHeader(TRACE_ID_HEADER,  traceId);
        response.setHeader(REQUEST_ID_HEADER, requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_TRACE_ID);
            MDC.remove(MDC_REQUEST_ID);
        }
    }

    private String getOrGenerate(HttpServletRequest request, String header) {
        String value = request.getHeader(header);
        return (value != null && !value.isBlank()) ? value : UUID.randomUUID().toString();
    }
}
