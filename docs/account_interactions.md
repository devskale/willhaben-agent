# Account Interactions in Willhaben TUI

This document analyzes the current implementation of account-related features in the willhaben TUI application and identifies potential enhancements based on willhaben.at's typical user account functionalities.

## Implemented Features

### Authentication
- **Cookie-based Authentication**: Uses the `sweet-cookie` library to extract session cookies from installed browsers (Chrome, Edge, Firefox, Safari).
- **Session Validation**: Validates authentication by fetching the willhaben homepage and parsing user profile data from the `__NEXT_DATA__` script tag.
- **User Profile Extraction**: Extracts basic user information including name, email, user ID, postal code, and member since date.

### User Profile Management
- **Profile Display**: The `/me` command displays basic user profile information scraped during authentication.
- **Profile Fields**: Shows display name, email, user ID, postal code, and membership date.

### Favorites/Bookmarked Items
- **Starring Functionality**: Users can star/unstar items using the space key while browsing search results.
- **Persistent Storage**: Starred items are stored in a local SQLite database with full listing details.
- **Starred Items View**: The `/starred` command provides a dedicated view for managing favorited listings.
- **Database Schema**: Includes fields for title, price, location, description, seller info, and starring timestamp.

### Search History
- **History Tracking**: Automatically saves search queries and selected categories to local database.
- **History Management**: Maintains up to 100 recent unique searches with timestamps.
- **History View**: The `/history` command allows browsing and restoring previous searches.

## Potential Features

### Messaging System
- **Contact Sellers**: Implement functionality to send messages to sellers via willhaben's messaging system.
- **Inbox Management**: View received messages and conversations.
- **Message Templates**: Predefined message templates for common inquiries.
- **Real-time Notifications**: Integration with willhaben's notification system.

### Listing Management
- **Post New Ads**: Create and publish new listings with photos, descriptions, and pricing.
- **Edit Existing Ads**: Modify details of user's own active listings.
- **Ad Status Management**: View, pause, resume, or delete posted advertisements.
- **Draft System**: Save work-in-progress listings before publishing.

### Advanced User Preferences
- **Saved Searches**: Create and manage saved search queries with notification preferences.
- **Notification Settings**: Configure email/SMS alerts for new matching listings.
- **Privacy Settings**: Manage profile visibility and contact preferences.
- **Location Preferences**: Set default search locations and delivery preferences.

### Account Analytics
- **Listing Performance**: View statistics on ad views, inquiries, and engagement.
- **Search Analytics**: Track most searched categories and price ranges.
- **User Activity**: Review account activity log and login history.

### Payment and Transaction Features
- **Payment Integration**: Interface with willhaben's PayLivery payment system.
- **Transaction History**: View completed transactions and payment receipts.
- **Billing Management**: Manage payment methods and billing information.

## Limitations and Observations

### Technical Limitations
- **Cookie Dependency**: Authentication relies entirely on browser-stored cookies, requiring users to be logged in via web browser first.
- **No Programmatic Login**: Cannot authenticate users without pre-existing browser sessions.
- **Data Scraping Fragility**: Relies on parsing HTML and embedded JSON data, which may break with website updates.
- **Limited API Access**: No direct API integration; all data retrieved through web scraping techniques.

### Functional Limitations
- **Read-Only Browsing**: Current implementation is primarily for viewing and searching listings, with minimal account interaction.
- **Local-Only Features**: Favorites and search history are stored locally only, not synchronized with willhaben account.
- **No Offline Capability**: Requires active internet connection and valid authentication for all features.

### Security Considerations
- **Cookie Handling**: Storing and using browser cookies programmatically raises security concerns.
- **Data Privacy**: Local storage of user profile and listing data needs proper security measures.
- **Session Management**: No automatic session refresh or handling of expired authentication.

### Scalability Concerns
- **Database Design**: Current SQLite implementation is suitable for personal use but may not scale for multiple users.
- **Caching Strategy**: No caching mechanism for frequently accessed data like categories or search results.
- **Performance**: Web scraping approach may be slower than direct API calls for bulk operations.

## Recommendations

1. **API Integration**: Explore willhaben's official API or reverse-engineer additional endpoints for more reliable data access.
2. **Enhanced Authentication**: Implement OAuth or token-based authentication for programmatic access.
3. **Cloud Synchronization**: Add account synchronization for favorites and preferences across devices.
4. **Offline Mode**: Implement caching and offline viewing capabilities for favorited items.
5. **Security Audit**: Conduct thorough security review of cookie handling and data storage practices.
6. **Error Handling**: Improve error handling for network issues, authentication failures, and website changes.
7. **Testing**: Add comprehensive tests for authentication, data parsing, and account-related features.