package com.rentalcar.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * Redis cache configuration.
 *
 * YOUR design: 3 separate caches with different TTLs — richer and more
 *   precise than a single car-search cache.
 * DEEPAK's addition: CacheErrorHandler that logs and swallows Redis failures
 *   so the application degrades gracefully when Redis is unavailable rather
 *   than throwing exceptions to the caller.
 */
@Configuration
@EnableCaching
@Slf4j
public class RedisConfig implements CachingConfigurer {

    // Cache name constants — used by @Cacheable / @CacheEvict throughout the app
    public static final String CACHE_CAR_SEARCH  = "car-search";
    public static final String CACHE_CAR_DETAILS = "car-details";
    public static final String CACHE_CITIES      = "cities";

    private static final Duration CAR_SEARCH_TTL  = Duration.ofMinutes(10);
    private static final Duration CAR_DETAILS_TTL = Duration.ofMinutes(30);
    private static final Duration CITIES_TTL      = Duration.ofHours(1);

    /**
     * Graceful Redis failure handling — any cache error is logged as WARN
     * and the operation continues (cache miss fallback to DB).
     * Without this, a Redis blip would throw exceptions all the way to the client.
     */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            @Override
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache GET error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }
            @Override
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) {
                log.warn("Cache PUT error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }
            @Override
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) {
                log.warn("Cache EVICT error on '{}' key='{}': {}", cache.getName(), key, e.getMessage());
            }
            @Override
            public void handleCacheClearError(RuntimeException e, Cache cache) {
                log.warn("Cache CLEAR error on '{}': {}", cache.getName(), e.getMessage());
            }
        };
    }

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // GenericJackson2JsonRedisSerializer with type info — human-readable JSON
        // in redis-cli, resilient to class renames compared to JDK serialization.
        ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .activateDefaultTyping(
                new com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator(),
                ObjectMapper.DefaultTyping.NON_FINAL
            );

        var jsonSerializer = new GenericJackson2JsonRedisSerializer(mapper);

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(CAR_SEARCH_TTL)
            .disableCachingNullValues()
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer));

        Map<String, RedisCacheConfiguration> cacheConfigs = Map.of(
            CACHE_CAR_SEARCH,  defaultConfig.entryTtl(CAR_SEARCH_TTL),
            CACHE_CAR_DETAILS, defaultConfig.entryTtl(CAR_DETAILS_TTL),
            CACHE_CITIES,      defaultConfig.entryTtl(CITIES_TTL)
        );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }
}
