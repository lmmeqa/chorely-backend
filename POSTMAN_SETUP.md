# Chorely API - Postman Collection Setup

This guide will help you set up and use the Chorely API Postman collection for testing the complete user signup, create home, and login flow.

## 📋 Prerequisites

1. **Postman** installed on your computer
2. **Backend server** running locally (see main README.md)
3. **Supabase project** configured with authentication

## 🚀 Quick Setup

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select the `Chorely_API_Postman_Collection.json` file
4. The collection will be imported with all endpoints organized by category

### 2. Configure Environment Variables

1. In the collection, click on the **Variables** tab
2. Update the following variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `baseUrl` | Your backend server URL | `http://localhost:8787` |
| `supabaseUrl` | Your Supabase project URL | `https://your-project.supabase.co` |
| `supabaseAnonKey` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `userEmail` | Test user email | `test@example.com` |

### 3. Get Your Supabase Anon Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **anon public** key
4. Paste it into the `supabaseAnonKey` variable

## 🔐 Authentication Flow

The collection is organized to follow the proper authentication flow:

### Step 1: User Signup
- **Endpoint**: `1. Supabase Signup`
- **Purpose**: Create a new user account in Supabase
- **Note**: This sends a confirmation email (check your email or disable email confirmation in Supabase settings)

### Step 2: User Login
- **Endpoint**: `2. Supabase Login`
- **Purpose**: Get an access token from Supabase
- **Automation**: This request automatically sets the `accessToken` variable for subsequent requests

### Step 3: Backend Authentication
- **Endpoint**: `3. Authenticate User (Backend)`
- **Purpose**: Create/update user profile in the backend database
- **Uses**: The access token from step 2

### Step 4: Verify Profile
- **Endpoint**: `4. Get User Profile`
- **Purpose**: Verify the user profile was created successfully

## 🏠 Home Management Flow

After authentication, you can manage homes:

### Step 1: Create Home
- **Endpoint**: `1. Create Home`
- **Purpose**: Create a new home for the authenticated user
- **Automation**: Automatically sets the `homeId` variable

### Step 2: View User Homes
- **Endpoint**: `2. Get User Homes`
- **Purpose**: See all homes the user is a member of

## 🧹 Chores & Activities

Once you have a home, you can:

1. **Create Chores**: Add new chores to the home
2. **View Chores**: List all chores in the home
3. **Complete Chores**: Mark chores as completed
4. **Track Points**: View point totals for all users
5. **View Activities**: See recent activity history

## ⚖️ Disputes & Approvals

For completed chores, you can:

1. **Create Disputes**: Challenge a completed chore
2. **Vote on Disputes**: Approve or reject disputes
3. **View Dispute History**: Track all disputes and their outcomes

## 🔧 Testing Tips

### 1. Use the Collection Runner
- Select multiple requests to run in sequence
- Perfect for testing the complete flow

### 2. Check the Console
- Open Postman's console to see automatic variable updates
- Useful for debugging token and ID assignments

### 3. Monitor Backend Logs
- Keep your backend server running to see detailed, color-coded logs
- The new logging system shows request/response details, timing, and errors

### 4. Test Error Cases
- Try invalid tokens
- Test with missing required fields
- Verify proper error responses

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid token" errors**
   - Make sure you've completed the Supabase login step
   - Check that the `accessToken` variable is set

2. **"Home not found" errors**
   - Ensure you've created a home first
   - Check that the `homeId` variable is set

3. **Database connection errors**
   - Verify your backend server is running
   - Check that your database is properly configured

4. **Supabase authentication errors**
   - Verify your Supabase URL and anon key
   - Check that email confirmation is disabled or confirmed

### Debug Mode

To see detailed backend logs:
1. Start your backend with: `npm run dev:worker:network`
2. Watch the terminal for color-coded request/response logs
3. The logs show timing, status codes, request bodies, and error details

## 📱 Mobile Testing

To test from your phone:
1. Use the network-accessible backend: `npm run dev:worker:network`
2. Update `baseUrl` to your computer's IP address: `http://10.0.0.14:8787`
3. Import the collection on your phone's Postman app

## 🎯 Next Steps

Once you're comfortable with the basic flow:
1. Test edge cases and error conditions
2. Try the dispute and approval system
3. Test with multiple users in the same home
4. Explore the points and activity tracking features

Happy testing! 🚀
