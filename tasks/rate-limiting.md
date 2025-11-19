# Rate Limiting and Abuse Prevention Plan

This document outlines a plan to implement a multi-layered defense strategy to prevent system abuse, from simple overuse by a single user to more sophisticated automated attacks.

## Objective

The primary goal is to identify and mitigate excessive or malicious activity that could degrade service for others, incur unnecessary costs, or indicate an attempt to compromise the system.

## Layer 1: Per-User Activity-Based Limiting

This is the most basic level of defense, focused on the behavior of a single, authenticated user.

### Detection Mechanism

- **Source of Data:** We will monitor the user's activity feed. The activity feed provides a chronological record of user actions. The rate limiter will be implemented within the `ActivityFeedService` to analyze the actions of the `actorId`.
- **Defining "Too Much":** We will define what constitutes "too much" activity. This will be based on the frequency of events. For example, a threshold of **100 events within a 1-minute window**.
- **Implementation:** A new `RateLimiter` service will be created and injected into the `ActivityFeedService`. It will use a dedicated Firestore collection (`rate-limit-actors/{actorId}/logs`) to track event timestamps for each user.

### Action/Mitigation Strategy

When a user exceeds the defined activity threshold, we can take action.

1.  **Disable Firebase Account:**
    *   **Pros:** Effectively and immediately stops all activity from the user.
    *   **Cons:** This is a drastic measure, risks false positives, and creates a poor user experience. Re-enabling the account might require manual intervention.
    *   **Implementation:** Use the Firebase Admin SDK to disable the user account (`auth.updateUser(uid, { disabled: true })`).

2.  **Temporary Block (Soft Ban):**
    *   **Pros:** Less severe, gives the user a "cool-down" period, and can be automated.
    *   **Cons:** More complex to implement (requires storing and checking block status).
    *   **Implementation:** Use custom claims (`auth.setCustomUserClaims(uid, { blocked: true })`) and update security rules to enforce the block.

3.  **Throttling/Slowing Down:**
    *   **Pros:** Least disruptive; user can still use the service at a reduced rate.
    *   **Cons:** Most complex to implement.

4.  **Notification/Warning:**
    *   **Pros:** User-friendly.
    *   **Cons:** May not deter malicious actors.

### Limitations of Per-User Limiting
This approach is a valuable first step but is vulnerable to a **Sybil attack**. An attacker can easily bypass this limit by creating hundreds or thousands of user accounts and distributing their actions across them. It does not protect against volumetric attacks from a single machine or distributed sources.

## Layer 2: Advanced, Infrastructure-Level Defenses

To counter more sophisticated attacks, we need to move defenses to the infrastructure level, focusing on the nature of the *request* rather than the *user*.

### Bot Detection & "Proof of Humanity"
Before we can effectively rate-limit traffic, we must have reasonable confidence that the traffic is from a legitimate source. This is where bot detection comes in.

- **Tool:** **Firebase App Check** is the idiomatic solution in our ecosystem.
- **Function:** App Check's primary role is **attestation**, not rate limiting. It verifies that incoming requests originate from a genuine, untampered instance of our application running on a real device.
- **Mechanism:** It acts as a "Proof of Humanity" test. For web apps, it uses providers like **reCAPTCHA Enterprise** to analyze user behavior and determine if they are likely human. For mobile, it uses platform-native services (DeviceCheck on iOS, Play Integrity on Android).
- **Benefit:** This defense layer filters out a massive amount of fraudulent traffic from automated scripts, reverse-engineered APIs, and other non-genuine clients before they can even attempt to create a user or perform an action.

### Infrastructure-Level Rate Limiting (IP-based)
Once we've filtered out most bots, we can apply broader rate limits to catch remaining abuse, such as a single machine attempting to create many user accounts.

- **Tool:** **Google Cloud Armor** is the appropriate WAF (Web Application Firewall) for this.
- **Function:** Cloud Armor operates at the network edge, in front of a Google Cloud HTTP Load Balancer. It can inspect incoming traffic *before* it ever reaches our Firebase Functions.
- **Mechanism:** We can configure rules to throttle or temporarily ban requests based on their **IP address**. For example, we could set a rule to block an IP that makes more than 200 requests per minute.
- **Benefit:** This provides a highly efficient, scalable defense against volumetric attacks and abuse patterns that span across multiple user accounts but originate from a limited set of IP addresses.

## Proposed Phased Approach (Revised)

This layered approach allows us to start simply and add more robust protections over time.

1.  **Phase 1: Per-User Monitoring & Logging.**
    *   Create the `RateLimiter` service and integrate it with `ActivityFeedService`.
    *   Define an initial threshold (e.g., 100 events/minute).
    *   When the threshold is exceeded, log a high-severity warning in Cloud Logging. **Take no blocking action.** This allows us to gather data on normal versus abusive behavior without impacting users.

2.  **Phase 2: Implement Per-User Action (Soft Ban).**
    *   Based on the data from Phase 1, enable a temporary, automated "soft ban" using custom claims when a user exceeds the limit.
    *   Notify the user that their account has been temporarily suspended due to unusual activity.
    *   For repeated offenders, consider implementing a harsher penalty like a permanent ban, likely flagged for manual review initially.

3.  **Phase 3: Implement Bot Detection.**
    *   Integrate **Firebase App Check** into our web and mobile applications.
    *   Configure it with **reCAPTCHA Enterprise** (for web) and the appropriate mobile providers.
    *   Enforce App Check token validation in our callable Firebase Functions. This will ensure that only legitimate app clients can access our backend.

4.  **Phase 4: Implement Infrastructure Rate Limiting.**
    *   Expose our critical HTTP Firebase Functions (e.g., `createUser`, `addExpense`) via a Google Cloud HTTP Load Balancer.
    *   Place **Google Cloud Armor** in front of the load balancer.
    *   Configure Cloud Armor with rate-limiting rules based on IP address to prevent volumetric attacks and rapid account creation.

## Research Findings and Recommendations

### App Check Attestation
Firebase App Check with the reCAPTCHA Enterprise provider is the recommended "proof of humanity" layer. It allows invisible challenges, configurable token TTLs (30 minutes to 7 days), and a tunable risk threshold (default `0.5`). Start with the 1-hour TTL and default threshold while collecting score distributions before moving to enforcement. Enable monitoring mode initially so we can understand what traffic would have been flagged before blocking it.

### Cloud Armor Rate Limiting
Cloud Armor best practices suggest staging new policies in preview, ordering rules so explicit denies/throttles can’t be skipped, and combining IP-based limits with upstream bot indicators like App Check. Cloud Armor supports both `throttle` (gradual slowdown) and `rate_based_ban` (temporary quarantine), matching our soft-ban model. Initial thresholds should sit above the 99th percentile of observed traffic and be relaxed during planned surges. When fronting Firebase Functions with an HTTP Load Balancer, use `gcloud compute security-policies` to target specific paths (e.g., `/api/login`) so we can cap per-IP/fingerprint hits while still allowing non-critical endpoints more room.

### Firestore Collection Resilience
Writing every event to `rate-limit-actors/{actorId}/logs` risks hitting Firestore’s 500 sequential writes per document per second limit. Introduce sharding (append a random suffix or rotate among multiple log documents per actor) or batch counts into periodic summaries to avoid contention. Enable TTL cleanup on the collection so only the most recent minute or two of activity persists, keeping storage and cost predictable.
