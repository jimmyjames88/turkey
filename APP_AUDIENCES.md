# App-Specific JWT Audience Guide

## 🎯 **Overview**

TurKey now supports app-specific JWT audiences to improve security isolation. Each application can request tokens with its own audience, preventing cross-app token usage.

## 🔒 **Security Benefits**

- **Stolen Token Containment**: A stolen blog token cannot be used for your finance app
- **Principle of Least Privilege**: Tokens only work for their intended application
- **Clear Security Boundaries**: Each app has its own token scope

## 🚀 **How to Use**

### **1. Login with App-Specific Audience**

```bash
# Blog App Login
POST /v1/auth/login
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "tenantId": "personal",
  "audience": "my_blog"
}

# Photos App Login
POST /v1/auth/login
{
  "email": "user@example.com", 
  "password": "securePassword123!",
  "tenantId": "personal",
  "audience": "my_photos"
}

# Finance App Login
POST /v1/auth/login
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "tenantId": "personal", 
  "audience": "my_finance"
}
```

### **2. Refresh Tokens with App-Specific Audience**

```bash
# Blog App Refresh
POST /v1/auth/refresh
{
  "refreshToken": "rt_abc123...",
  "audience": "my_blog"
}

# Photos App Refresh  
POST /v1/auth/refresh
{
  "refreshToken": "rt_def456...",
  "audience": "my_photos"
}
```

### **3. Registration with App-Specific Audience**

```bash
# Register and get blog-specific token
POST /v1/auth/register
{
  "email": "newuser@example.com",
  "password": "securePassword123!",
  "tenantId": "personal",
  "role": "user",
  "audience": "my_blog"
}
```

## 🔧 **Environment Configuration**

### **Option 1: Default Audience (Current Setup)**
Keep your current setup for backward compatibility:

```bash
# .env.local
JWT_AUDIENCE=turkey
```

When `audience` is not specified in requests, tokens default to "turkey".

### **Option 2: Require App-Specific Audiences**
For maximum security, you could modify TurKey to require audience:

```bash
# .env.local - Remove default audience
# JWT_AUDIENCE=turkey  # Comment out to require explicit audience
```

## 🧪 **Testing Different Apps**

### **Blog App Example**
```javascript
// Blog app configuration
const BLOG_AUDIENCE = 'my_blog';

const loginResponse = await fetch('/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123!',
    tenantId: 'personal',
    audience: BLOG_AUDIENCE  // Blog-specific audience
  })
});

const { accessToken } = await loginResponse.json();

// This token will have "aud": "my_blog"
// It won't work for photos or finance apps
```

### **Photos App Example**
```javascript
// Photos app configuration  
const PHOTOS_AUDIENCE = 'my_photos';

const loginResponse = await fetch('/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123!', 
    tenantId: 'personal',
    audience: PHOTOS_AUDIENCE  // Photos-specific audience
  })
});

// This token will have "aud": "my_photos"
// It won't work for blog or finance apps
```

## 🛡️ **Security Validation**

Your applications should validate the audience in received tokens:

```javascript
// In your app's JWT validation middleware
const jwt = require('jsonwebtoken');

function validateAppToken(token, expectedAudience) {
  try {
    const decoded = jwt.decode(token);
    
    // Check if token audience matches your app
    if (decoded.aud !== expectedAudience) {
      throw new Error(`Token not intended for this app. Expected: ${expectedAudience}, Got: ${decoded.aud}`);
    }
    
    // Continue with normal JWT verification...
    return decoded;
  } catch (error) {
    throw new Error('Invalid token for this application');
  }
}

// Usage in blog app
const blogToken = validateAppToken(accessToken, 'my_blog');

// Usage in photos app  
const photosToken = validateAppToken(accessToken, 'my_photos');
```

## 📊 **Token Structure Comparison**

### **Default Audience Token**
```json
{
  "iss": "https://turkey.example.com",
  "aud": "turkey",
  "sub": "user123",
  "tenantId": "personal",
  "role": "user"
}
```

### **App-Specific Audience Token**  
```json
{
  "iss": "https://turkey.example.com",
  "aud": "my_blog",
  "sub": "user123", 
  "tenantId": "personal",
  "role": "user"
}
```

## 🎯 **Best Practices**

1. **Use Descriptive Audience Names**: `my_blog`, `my_photos`, `my_finance`
2. **Consistent Naming**: Use the same audience string across your app
3. **Validate on Both Sides**: TurKey issues app-specific tokens, your apps validate them
4. **Separate Refresh Tokens**: Each app manages its own refresh tokens
5. **Document Your Audiences**: Keep a list of all your app audiences

## 🔄 **Migration Strategy**

If you have existing apps using the default audience:

1. **Phase 1**: Add audience support (current implementation)
2. **Phase 2**: Update apps one by one to use specific audiences  
3. **Phase 3**: Eventually remove default audience for maximum security

Your current setup remains fully backward compatible! 🦃