# Chorely API Postman Testing Guide

New modular flow collections are available under `backend/postman/flows/`.
Each flow is a small Postman collection that uses the same environment.

This guide will help you set up and use the Postman collection to test all Chorely API endpoints.

## Setup Instructions

### 1. Import Files
1. Open Postman
2. Click **Import** button
3. Import both files:
   - `Chorely_API_Postman_Collection.json` - The API collection
   - `Chorely_API_Environment.json` - The environment variables

### 2. Set Environment
1. In the top-right corner, select **"Chorely API Environment"** from the environment dropdown
2. Verify the `base_url` is set to `http://localhost:4000`

### 3. Start the Backend
```bash
cd backend
docker compose up --build
```

## Testing Workflow

### Step 1: Create Test Data
Start with these requests in order:

1. **Create Home** (`Homes > Create Home`)
   - This will automatically save the `home_id` to your environment
   - Expected: 201 Created

2. **Create User** (`Users > Create User`)
   - Uses the `home_id` from step 1
   - Expected: 201 Created

### Step 2: Test User Operations
3. **Login User** (`Users > Login User`)
   - Expected: 200 OK with user data

4. **Get User by Email** (`Users > Get User by Email`)
   - Expected: 200 OK with user data

5. **Get User Homes** (`Users > Get User Homes`)
   - Expected: 200 OK with array of homes

### Step 3: Test Home Operations
6. **Get All Homes** (`Homes > Get All Homes`)
   - Expected: 200 OK with array of homes

7. **Get Home by ID** (`Homes > Get Home by ID`)
   - Expected: 200 OK with home data

8. **Get Home Users** (`Homes > Get Home Users`)
   - Expected: 200 OK with array of users

### Step 4: Test Chore Operations
9. **Create Chore** (`Chores > Create Chore`)
   - This will automatically save the `chore_uuid` to your environment
   - Expected: 201 Created

10. **Get Chore by UUID** (`Chores > Get Chore by UUID`)
    - Expected: 200 OK with chore data

11. **Get Unapproved Chores** (`Chores > Get Unapproved Chores`)
    - Expected: 200 OK with array of unapproved chores

### Step 5: Test Approval System
12. **Get Approval Status** (`Approvals > Get Approval Status`)
    - Expected: 200 OK with approval data

13. **Vote for Approval** (`Approvals > Vote for Approval`)
    - Expected: 200 OK with updated approval data

14. **Get Approval Status** (again)
    - Verify the vote was recorded

### Step 6: Test Chore Lifecycle
15. **Approve Chore** (`Chores > Approve Chore`)
    - Expected: 204 No Content

16. **Get Available Chores** (`Chores > Get Available Chores`)
    - Expected: 200 OK with array of available chores

17. **Claim Chore** (`Chores > Claim Chore`)
    - Expected: 204 No Content

18. **Get User Chores** (`Chores > Get User Chores`)
    - Expected: 200 OK with user's claimed chores

19. **Complete Chore** (`Chores > Complete Chore`)
    - Expected: 204 No Content

### Step 7: Test Points System
20. **Get User Points** (`Points > Get User Points`)
    - Expected: 200 OK with points data

21. **Add Points to User** (`Points > Add Points to User`)
    - Expected: 200 OK with updated points

22. **Get All User Points** (`Points > Get All User Points`)
    - Expected: 200 OK with all users' points

### Step 8: Test Disputes
23. **Create Dispute** (`Disputes > Create Dispute`)
    - Expected: 201 Created with dispute data

24. **Get Disputes** (`Disputes > Get Disputes`)
    - Expected: 200 OK with array of disputes

25. **Approve Dispute** (`Disputes > Approve Dispute`)
    - Expected: 204 No Content

### Step 9: Test Activity and Todos
26. **Get Recent Activity** (`Activity > Get Recent Activity`)
    - Expected: 200 OK with activity data

27. **Get Todo Items** (`Todos > Get Todo Items`)
    - Expected: 200 OK with todo items

## Environment Variables

The collection uses these environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `base_url` | API base URL | `http://localhost:4000` |
| `user_email` | Test user email | `test@example.com` |
| `user_name` | Test user name | `Test User` |
| `home_id` | Home UUID (auto-populated) | `uuid-here` |
| `home_name` | Home name | `Test Home` |
| `chore_uuid` | Chore UUID (auto-populated) | `uuid-here` |
| `chore_name` | Chore name | `Test Chore` |
| `chore_description` | Chore description | `This is a test chore` |
| `chore_time` | Chore time | `2024-01-15T10:00:00Z` |
| `chore_icon` | Chore icon | `🧹` |
| `chore_points` | Chore points | `10` |
| `dispute_uuid` | Dispute UUID (auto-populated) | `uuid-here` |
| `dispute_reason` | Dispute reason | `Chore was not completed properly` |
| `dispute_image_url` | Dispute image URL | `https://example.com/image.jpg` |

## Auto-Population Features

The collection includes scripts that automatically:

1. **Generate UUIDs** for `chore_uuid` and `dispute_uuid` if not set
2. **Save IDs** from responses:
   - `home_id` from Create Home response
   - `chore_uuid` from Create Chore response
3. **Run tests** on every request:
   - Status code validation (200, 201, 204)
   - Response time validation (< 2000ms)

## Common Test Scenarios

### Scenario 1: Complete Chore Workflow
1. Create Home
2. Create User
3. Create Chore
4. Vote for Approval
5. Approve Chore
6. Claim Chore
7. Complete Chore
8. Check Points

### Scenario 2: Dispute Workflow
1. Create Home
2. Create User
3. Create Chore
4. Complete Chore
5. Create Dispute
6. Approve Dispute

### Scenario 3: Multiple Users
1. Create Home
2. Create User 1
3. Create User 2
4. Join User 2 to Home
5. Create Chore
6. Both users vote for approval
7. Verify approval threshold met

## Troubleshooting

### Common Issues

1. **404 Not Found**
   - Check if backend is running on `http://localhost:4000`
   - Verify environment variables are set correctly

2. **400 Bad Request**
   - Check request body format
   - Verify all required fields are present

3. **409 Conflict**
   - User email already exists
   - Try a different email address

4. **500 Server Error**
   - Check backend logs
   - Verify database is running

### Debug Tips

1. **Check Environment Variables**
   - Click the eye icon in the top-right to view current values
   - Verify `base_url` is correct

2. **View Response Details**
   - Check the response body for error messages
   - Verify status codes match expectations

3. **Use Console Logs**
   - Open browser dev tools to see any JavaScript errors
   - Check Postman console for script errors

## Advanced Testing

### Custom Test Scripts
You can add custom test scripts to individual requests:

```javascript
// Example: Test specific response fields
pm.test("User has correct email", function () {
    const response = pm.response.json();
    pm.expect(response.email).to.eql(pm.environment.get("user_email"));
});
```

### Data-Driven Testing
Create multiple environment files for different test scenarios:
- `Chorely_API_Environment_User1.json`
- `Chorely_API_Environment_User2.json`

### Collection Runner
Use Postman's Collection Runner to:
- Run all requests in sequence
- Generate test reports
- Set up automated testing

## API Documentation
For detailed API documentation, see `ApiDoc.md` in the backend directory.
