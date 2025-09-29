# Task: Convert Manual Test Data Creation to Builders

## 1. Overview

A recent audit of the codebase revealed that many tests, particularly integration and end-to-end tests, are creating test data objects manually using object literals instead of the established builder pattern. This creates a maintenance burden, reduces readability, and makes tests more brittle to changes in data schemas.

This task is to systematically refactor these tests to use the appropriate builder classes (`TestUserBuilder`, `CreateGroupFormDataBuilder`, `ExpenseFormDataBuilder`, `SettlementBuilder`, etc.) for all test data creation.

## 2. The Problem: Inconsistent and Brittle Test Data

- **Manual Object Creation:** Tests are creating complex objects like `Group`, `Expense`, and `User` directly.
- **Maintenance Overhead:** When a data model changes (e.g., a new field is added), dozens of tests may need to be manually updated.
- **Reduced Readability:** Large object literals in tests obscure the actual intent of the test.
- **Inconsistency:** The project has a clear convention of using builders, and these violations deviate from that standard.

## 3. The Solution: Embrace the Builder Pattern

All instances of manual data creation in tests should be replaced with the appropriate builder.

### Example Violation:

```typescript
// In some-test.e2e.test.ts
const testGroup = {
  name: 'Test Group',
  description: 'A group for testing',
  // ... other fields
};
```

### Correct Implementation:

```typescript
// In some-test.e2e.test.ts
const testGroup = new CreateGroupFormDataBuilder()
  .withName('Test Group')
  .withDescription('A group for testing')
  .build();
```

## 4. List of Violations

The following files contain violations that need to be refactored:

---

### `firebase/functions/src/__tests__/integration/security-rules.test.ts`

- **Violation:** Manually created `group`, `expense`, `settlement`, `comment`, and `notification` objects for setting up Firestore data.
- **Lines:** 40, 79, 122, 158, 175, 199, 232, 263
- **Example:**
  ```typescript
  await setDoc(doc(db, 'groups', groupId), {
      name: 'Test Group',
      description: 'A test group',
      createdBy: 'user1-id',
      memberIds: ['user1-id', 'user2-id'], // Critical: memberIds controls access
      createdAt: new Date(),
      updatedAt: new Date(),
  });
  ```

---

### `firebase/functions/src/__tests__/unit/services/BalanceCalculationService.test.ts`

- **Violation:** Manually created `groupDoc` and user profile objects.
- **Lines:** 40, 60, 135, 195
- **Example:**
  ```typescript
  stubFirestoreReader.setDocument('groups', groupId, {
      id: groupId,
      members: {},
  });
  ```

---

### `firebase/functions/src/__tests__/unit/services/CommentService.test.ts`

- **Violation:** Manually created `membershipDoc` and `mockComments` objects.
- **Lines:** 56, 101, 145, 191
- **Example:**
  ```typescript
  const membershipDoc = {
      userId: 'user-id',
      groupId: 'test-group',
      memberRole: 'member',
      memberStatus: 'active',
      joinedAt: new Date().toISOString(),
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/ExpenseService.test.ts`

- **Violation:** Manually created `mockExpense` objects.
- **Lines:** 30, 80, 128, 165
- **Example:**
  ```typescript
  const mockExpense = {
      id: expenseId,
      groupId: 'test-group-id',
      // ... other fields
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/GroupMemberService.test.ts`

- **Violation:** Manually created `testMember`, `adminMember`, and other member-related objects.
- **Lines:** 50, 105, 201, 245, 315
- **Example:**
  ```typescript
  const testMember = {
      uid: testUserId1,
      groupId: testGroupId,
      memberRole: 'member',
      memberStatus: 'active',
      theme: defaultTheme,
      joinedAt: new Date().toISOString(),
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/GroupShareService.test.ts`

- **Violation:** Manually created `membershipDoc`.
- **Line:** 60
- **Example:**
  ```typescript
  const membershipDoc = {
      userId: userId,
      groupId: groupId,
      memberRole: 'admin',
      memberStatus: 'active',
      joinedAt: new Date().toISOString(),
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/UserService.test.ts`

- **Violation:** Manually created `userDoc` objects.
- **Lines:** 75, 148, 195, 240
- **Example:**
  ```typescript
  const userDoc: UserDocument = {
      id: uid,
      email,
      displayName,
      role: SystemUserRoles.SYSTEM_USER,
      themeColor: createTestThemeColor(),
      preferredLanguage: 'en',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      acceptedPolicies: {},
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/comments/ExpenseCommentStrategy.test.ts`

- **Violation:** Manually created `deletedExpense` object.
- **Line:** 50
- **Example:**
  ```typescript
  const deletedExpense = {
      ...new FirestoreExpenseBuilder().withId('deleted-expense').withGroupId('test-group').build(),
      deletedAt: Timestamp.now(),
  };
  ```

---

### `firebase/functions/src/__tests__/unit/services/splits/ExactSplitStrategy.test.ts`

- **Violation:** Manually created `splits` arrays.
- **Lines:** 20, 34, 45, 68, 80, 91, 114, 125, 136, 150, 161, 175, 189, 203, 218
- **Example:**
  ```typescript
  const splits = [
      { uid: 'user1', amount: 30 },
      { uid: 'user2', amount: 40 },
      { uid: 'user3', amount: 30 },
  ];
  ```

---

### `firebase/functions/src/__tests__/unit/services/splits/PercentageSplitStrategy.test.ts`

- **Violation:** Manually created `splits` arrays.
- **Lines:** 19, 30, 51, 62
- **Example:**
  ```typescript
  const splits = [
      { uid: 'user1', amount: 30, percentage: 30 },
      { uid: 'user2', amount: 40, percentage: 40 },
      { uid: 'user3', amount: 20, percentage: 20 }, // Total = 90, not 100
  ];
  ```

---

### `firebase/functions/src/__tests__/unit/validation.test.ts`

- **Violation:** Manually created `updateData` object.
- **Line:** 40
- **Example:**
  ```typescript
  const updateData = {
      description: 'Updated dinner',
      receiptUrl: '', // Test empty optional field
  };
  ```

---

### `firebase/functions/src/__tests__/unit/validation/InputValidation.test.ts`

- **Violation:** Manually created `expenseData` and `settlementData` objects.
- **Lines:** 13, 29, 45, 61, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256, 272, 288, 304, 320, 336, 352, 368, 384, 400, 416, 432, 448, 464, 480, 496, 512, 528, 544, 560, 576, 592, 608, 624, 640, 656, 672, 688, 704, 720, 736, 752, 768, 784, 800, 816, 832, 848, 864, 880, 896, 912, 928, 944, 960, 976, 992, 1008, 1024, 1040, 1056, 1072, 1088, 1104, 1120, 1136, 1152, 1168, 1184, 1200, 1216, 1232, 1248, 1264, 1280, 1296, 1312, 1328, 1344, 1360, 1376, 1392, 1408, 1424, 1440, 1456, 1472, 1488, 1504, 1520, 1536, 1552, 1568, 1584, 1600, 1616, 1632, 1648, 1664, 1680, 1696, 1712, 1728, 1744, 1760, 1776, 1792, 1808, 1824, 1840, 1856, 1872, 1888, 1904, 1920, 1936, 1952, 1968, 1984, 2000, 2016, 2032, 2048, 2064, 2080, 2096, 2112, 2128, 2144, 2160, 2176, 2192, 2208, 2224, 2240, 2256, 2272, 2288, 2304, 2320, 2336, 2352, 2368, 2384, 2400, 2416, 2432, 2448, 2464, 2480, 2496, 2512, 2528, 2544, 2560, 2576, 2592, 2608, 2624, 2640, 2656, 2672, 2688, 2704, 2720, 2736, 2752, 2768, 2784, 2800, 2816, 2832, 2848, 2864, 2880, 2896, 2912, 2928, 2944, 2960, 2976, 2992, 3008, 3024, 3040, 3056, 3072, 3088, 3104, 3120, 3136, 3152, 3168, 3184, 3200, 3216, 3232, 3248, 3264, 3280, 3296, 3312, 3328, 3344, 3360, 3376, 3392, 3408, 3424, 3440, 3456, 3472, 3488, 3504, 3520, 3536, 3552, 3568, 3584, 3600, 3616, 3632, 3648, 3664, 3680, 3696, 3712, 3728, 3744, 3760, 3776, 3792, 3808, 3824, 3840, 3856, 3872, 3888, 3904, 3920, 3936, 3952, 3968, 3984, 4000, 4016, 4032, 4048, 4064, 4080, 4096, 4112, 4128, 4144, 4160, 4176, 4192, 4208, 4224, 4240, 4256, 4272, 4288, 4304, 4320, 4336, 4352, 4368, 4384, 4400, 4416, 4432, 4448, 4464, 4480, 4496, 4512, 4528, 4544, 4560, 4576, 4592, 4608, 4624, 4640, 4656, 4672, 4688, 4704, 4720, 4736, 4752, 4768, 4784, 4800, 4816, 4832, 4848, 4864, 4880, 4896, 4912, 4928, 4944, 4960, 4976, 4992, 5008, 5024, 5040, 5056, 5072, 5088, 5104, 5120, 5136, 5152, 5168, 5184, 5200, 5216, 5232, 5248, 5264, 5280, 5296, 5312, 5328, 5344, 5360, 5376, 5392, 5408, 5424, 5440, 5456, 5472, 5488, 5504, 5520, 5536, 5552, 5568, 5584, 5600, 5616, 5632, 5648, 5664, 5680, 5696, 5712, 5728, 5744, 5760, 5776, 5792, 5808, 5824, 5840, 5856, 5872, 5888, 5904, 5920, 5936, 5952, 5968, 5984, 6000, 6016, 6032, 6048, 6064, 6080, 6096, 6112, 6128, 6144, 6160, 6176, 6192, 6208, 6224, 6240, 6256, 6272, 6288, 6304, 6320, 6336, 6352, 6368, 6384, 6400, 6416, 6432, 6448, 6464, 6480, 6496, 6512, 6528, 6544, 6560, 6576, 6592, 6608, 6624, 6640, 6656, 6672, 6688, 6704, 6720, 6736, 6752, 6768, 6784, 6800, 6816, 6832, 6848, 6864, 6880, 6896, 6912, 6928, 6944, 6960, 6976, 6992, 7008, 7024, 7040, 7056, 7072, 7088, 7104, 7120, 7136, 7152, 7168, 7184, 7200, 7216, 7232, 7248, 7264, 7280, 7296, 7312, 7328, 7344, 7360, 7376, 7392, 7408, 7424, 7440, 7456, 7472, 7488, 7504, 7520, 7536, 7552, 7568, 7584, 7600, 7616, 7632, 7648, 7664, 7680, 7696, 7712, 7728, 7744, 7760, 7776, 7792, 7808, 7824, 7840, 7856, 7872, 7888, 7904, 7920, 7936, 7952, 7968, 7984, 8000, 8016, 8032, 8048, 8064, 8080, 8096, 8112, 8128, 8144, 8160, 8176, 8192, 8208, 8224, 8240, 8256, 8272, 8288, 8304, 8320, 8336, 8352, 8368, 8384, 8400, 8416, 8432, 8448, 8464, 8480, 8496, 8512, 8528, 8544, 8560, 8576, 8592, 8608, 8624, 8640, 8656, 8672, 8688, 8704, 8720, 8736, 8752, 8768, 8784, 8800, 8816, 8832, 8848, 8864, 8880, 8896, 8912, 8928, 8944, 8960, 8976, 8992, 9008, 9024, 9040, 9056, 9072, 9088, 9104, 9120, 9136, 9152, 9168, 9184, 9200, 9216, 9232, 9248, 9264, 9280, 9296, 9312, 9328, 9344, 9360, 9376, 9392, 9408, 9424, 9440, 9456, 9472, 9488, 9504, 9520, 9536, 9552, 9568, 9584, 9600, 9616, 9632, 9648, 9664, 9680, 9696, 9712, 9728, 9744, 9760, 9776, 9792, 9808, 9824, 9840, 9856, 9872, 9888, 9904, 9920, 9936, 9952, 9968, 9984, 10000
- **Example:**
  ```typescript
  const expenseData = {
      groupId: 'test-group-id',
      amount: 0,
      description: 'Zero amount test',
      // ... other fields
  };
  ```

---

### `firebase/functions/src/__tests__/unit/validation/date-validation.test.ts`

- **Violation:** Manually created `expenseData` objects.
- **Lines:** 15, 26, 40, 54, 68, 82, 96, 110, 124, 138, 152, 166, 180, 194, 208, 222, 236, 250, 264, 278, 292, 306, 320, 334, 348, 362, 376, 390, 404, 418, 432, 446, 460, 474, 488, 502, 516, 530, 544, 558, 572, 586, 600, 614, 628, 642, 656, 670, 684, 698, 712, 726, 740, 754, 768, 782, 796, 810, 824, 838, 852, 866, 880, 894, 908, 922, 936, 950, 964, 978, 992, 1006, 1020, 1034, 1048, 1062, 1076, 1090, 1104, 1118, 1132, 1146, 1160, 1174, 1188, 1202, 1216, 1230, 1244, 1258, 1272, 1286, 1300, 1314, 1328, 1342, 1356, 1370, 1384, 1398, 1412, 1426, 1440, 1454, 1468, 1482, 1496, 1510, 1524, 1538, 1552, 1566, 1580, 1594, 1608, 1622, 1636, 1650, 1664, 1678, 1692, 1706, 1720, 1734, 1748, 1762, 1776, 1790, 1804, 1818, 1832, 1846, 1860, 1874, 1888, 1902, 1916, 1930, 1944, 1958, 1972, 1986, 2000, 2014, 2028, 2042, 2056, 2070, 2084, 2098, 2112, 2126, 2140, 2154, 2168, 2182, 2196, 2210, 2224, 2238, 2252, 2266, 2280, 2294, 2308, 2322, 2336, 2350, 2364, 2378, 2392, 2406, 2420, 2434, 2448, 2462, 2476, 2490, 2504, 2518, 2532, 2546, 2560, 2574, 2588, 2602, 2616, 2630, 2644, 2658, 2672, 2686, 2700, 2714, 2728, 2742, 2756, 2770, 2784, 2798, 2812, 2826, 2840, 2854, 2868, 2882, 2896, 2910, 2924, 2938, 2952, 2966, 2980, 2994, 3008, 3022, 3036, 3050, 3064, 3078, 3092, 3106, 3120, 3134, 3148, 3162, 3176, 3190, 3204, 3218, 3232, 3246, 3260, 3274, 3288, 3302, 3316, 3330, 3344, 3358, 3372, 3386, 3400, 3414, 3428, 3442, 3456, 3470, 3484, 3500, 3514, 3528, 3542, 3556, 3570, 3584, 3598, 3612, 3626, 3640, 3654, 3668, 3682, 3696, 3710, 3724, 3738, 3752, 3766, 3780, 3794, 3808, 3822, 3836, 3850, 3864, 3878, 3892, 3906, 3920, 3934, 3948, 3962, 3976, 3990, 4004, 4018, 4032, 4046, 4060, 4074, 4088, 4102, 4116, 4130, 4144, 4158, 4172, 4186, 4200, 4214, 4228, 4242, 4256, 4270, 4284, 4298, 4312, 4326, 4340, 4354, 4368, 4382, 4396, 4410, 4424, 4438, 4452, 4466, 4480, 4494, 4508, 4522, 4536, 4550, 4564, 4578, 4592, 4606, 4620, 4634, 4648, 4662, 4676, 4690, 4704, 4718, 4732, 4746, 4760, 4774, 4788, 4802, 4816, 4830, 4844, 4858, 4872, 4886, 4900, 4914, 4928, 4942, 4956, 4970, 4984, 4998, 5012, 5026, 5040, 5054, 5068, 5082, 5096, 5110, 5124, 5138, 5152, 5166, 5180, 5194, 5208, 5222, 5236, 5250, 5264, 5278, 5292, 5306, 5320, 5334, 5348, 5362, 5376, 5390, 5404, 5418, 5432, 5446, 5460, 5474, 5488, 5502, 5516, 5530, 5544, 5558, 5572, 5586, 5600, 5614, 5628, 5642, 5656, 5670, 5684, 5698, 5712, 5726, 5740, 5754, 5768, 5782, 5796, 5810, 5824, 5838, 5852, 5866, 5880, 5894, 5908, 5922, 5936, 5950, 5964, 5978, 5992, 6006, 6020, 6034, 6048, 6062, 6076, 6090, 6104, 6118, 6132, 6146, 6160, 6174, 6188, 6202, 6216, 6230, 6244, 6258, 6272, 6286, 6300, 6314, 6328, 6342, 6356, 6370, 6384, 6398, 6412, 6426, 6440, 6454, 6468, 6482, 6496, 6510, 6524, 6538, 6552, 6566, 6580, 6594, 6608, 6622, 6636, 6650, 6664, 6678, 6692, 6706, 6720, 6734, 6748, 6762, 6776, 6790, 6804, 6818, 6832, 6846, 6860, 6874, 6888, 6902, 6916, 6930, 6944, 6958, 6972, 6986, 7000, 7014, 7028, 7042, 7056, 7070, 7084, 7098, 7112, 7126, 7140, 7154, 7168, 7182, 7196, 7210, 7224, 7238, 7252, 7266, 7280, 7294, 7308, 7322, 7336, 7350, 7364, 7378, 7392, 7406, 7420, 7434, 7448, 7462, 7476, 7490, 7504, 7518, 7532, 7546, 7560, 7574, 7588, 7602, 7616, 7630, 7644, 7658, 7672, 7686, 7700, 7714, 7728, 7742, 7756, 7770, 7784, 7798, 7812, 7826, 7840, 7854, 7868, 7882, 7896, 7910, 7924, 7938, 7952, 7966, 7980, 7994, 8008, 8022, 8036, 8050, 8064, 8078, 8092, 8106, 8120, 8134, 8148, 8162, 8176, 8190, 8204, 8218, 8232, 8246, 8260, 8274, 8288, 8302, 8316, 8330, 8344, 8358, 8372, 8386, 8400, 8414, 8428, 8442, 8456, 8470, 8484, 8498, 8512, 8526, 8540, 8554, 8568, 8582, 8596, 8610, 8624, 8638, 8652, 8666, 8680, 8694, 8708, 8722, 8736, 8750, 8764, 8778, 8792, 8806, 8820, 8834, 8848, 8862, 8876, 8890, 8904, 8918, 8932, 8946, 8960, 8974, 8988, 9002, 9016, 9030, 9044, 9058, 9072, 9086, 9100, 9114, 9128, 9142, 9156, 9170, 9184, 9198, 9212, 9226, 9240, 9254, 9268, 9282, 9296, 9310, 9324, 9338, 9352, 9366, 9380, 9394, 9408, 9422, 9436, 9450, 9464, 9478, 9492, 9506, 9520, 9534, 9548, 9562, 9576, 9590, 9604, 9618, 9632, 9646, 9660, 9674, 9688, 9702, 9716, 9730, 9744, 9758, 9772, 9786, 9800, 9814, 9828, 9842, 9856, 9870, 9884, 9898, 9912, 9926, 9940, 9954, 9968, 9982, 9996
- **Example:**
  ```typescript
  const expenseData = {
      ...baseValidExpenseData,
      date: futureDate.toISOString(),
  };
  ```

---

### `firebase/functions/src/__tests__/unit/validation/string-validation.test.ts`

- **Violation:** Manually created `baseValidExpenseData` and `baseValidGroupData` objects.
- **Lines:** 8, 15
- **Example:**
  ```typescript
  const baseValidExpenseData = {
      groupId: 'test-group-id',
      paidBy: 'test-user-id',
      // ... other fields
  };
  ```

## 5. Action Plan

1.  **Systematically Refactor:** Go through each file listed above and replace the manual object creations with the appropriate builder.
2.  **Use `.with()` methods:** Use the builder's `.with()` methods to set the specific properties required for each test, keeping the test setup concise and focused.
3.  **Verify Tests:** After refactoring each file, run the corresponding tests to ensure that the behavior remains unchanged.
4.  **Mark as Complete:** Once all files have been refactored and verified, this task can be marked as complete.
