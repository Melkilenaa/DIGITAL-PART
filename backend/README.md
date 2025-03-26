# DAMPS - Digital Auto-parts Market Place Services

DAMPS is a comprehensive e-commerce platform designed specifically for the automotive parts industry. The platform connects customers with auto-part vendors while providing delivery services through dedicated drivers, all managed through an administrative backend.

## Table of Contents

- [System Architecture](#system-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Database Design](#database-design)
- [Core Features](#core-features)
- [User Journeys](#user-journeys)
  - [Customer Journey](#customer-journey)
  - [Vendor Journey](#vendor-journey)
  - [Driver Journey](#driver-journey)
  - [Admin Journey](#admin-journey)
- [Module Details](#module-details)
  - [Parts Management](#parts-management)
  - [Order Processing](#order-processing)
  - [Payment Flow](#payment-flow)
  - [Delivery System](#delivery-system)
- [Future Implementations](#future-implementations)

## System Architecture

DAMPS is built on a modern tech stack ensuring scalability, performance, and maintainability:

- **Backend**: Node.js with Express framework
- **Database**: PostgreSQL with Prisma ORM
- **API Structure**: RESTful API design
- **Authentication**: JWT-based authentication with role-based access control
- **File Storage**: Cloud-based storage for images and documents
- **Payment Processing**: Integration with payment gateways

## Authentication & Authorization

### Auth Flow

1. **Registration Process**:
   - Users register as either customers, vendors, or drivers
   - Required details vary based on role:
     - Customers: basic profile information
     - Vendors: business details and documents for verification
     - Drivers: personal documents, vehicle information, and driving license

2. **Authentication**: 
   - JWT-based authentication with role-based tokens
   - Tokens include userId, role, and sessionId
   - Authentication middleware validates tokens on protected routes

3. **Authorization**:
   - Role guard middleware restricts access based on user roles
   - Fine-grained permission control for admin users with different permission levels (STANDARD, ELEVATED, SUPER_ADMIN)

4. **Password Security**:
   - Passwords are hashed using bcryptjs
   - Password reset functionality with time-limited reset tokens

## Database Design

The database is designed with a focus on:

- **Relationship Integrity**: Well-defined relationships between entities with appropriate cascade behaviors
- **Performance**: Strategic indexes on frequently queried fields
- **Data Validation**: Enum types for consistent data entry
- **Flexibility**: JSON fields for dynamic data structures (e.g., specifications, operating hours)

## Core Features

- Multi-vendor marketplace for auto parts
- Comprehensive parts catalog with categories and search capabilities
- Order management system with real-time status updates
- Integrated delivery system with driver assignment
- Payment processing with multiple payment methods
- Promotion and discount system
- Reviews and ratings for vendors and drivers
- Analytics and reporting

## User Journeys

### Customer Journey

1. **Onboarding**:
   - Register an account with basic details
   - Complete profile with address information and vehicle details
   - Save payment methods for future purchases

2. **Shopping Experience**:
   - Browse parts by category or search functionality
   - Filter parts based on compatibility with saved vehicles
   - View detailed part information, specifications, and compatibility
   - Add items to wishlist or cart
   - Track recently viewed items

3. **Ordering Process**:
   - Review cart items and adjust quantities
   - Apply promotion codes if available
   - Select delivery address
   - Choose payment method
   - Place order

4. **Post-Purchase**:
   - Track order status in real-time
   - Track delivery through the delivery tracking system
   - Rate delivery experience
   - Review purchased items and vendor
   - Request refund if needed

### Vendor Journey

1. **Onboarding**:
   - Register with business details
   - Submit verification documents
   - Set up operating hours and business profile
   - Configure bank details for payment receiving
   - Await admin verification

2. **Catalog Management**:
   - Add parts with detailed specifications
   - Organize parts into categories
   - Manage inventory and set low stock alerts
   - Update pricing and discounts
   - Create special promotions

3. **Order Management**:
   - Receive notifications for new orders
   - Process and prepare orders
   - Mark orders as ready for pickup
   - Generate shipping labels and documentation

4. **Business Operations**:
   - View sales analytics and reports
   - Manage customer reviews
   - Handle refund requests
   - Request payouts for earnings

### Driver Journey

1. **Onboarding**:
   - Register with personal details
   - Submit verification documents (driving license, insurance, ID)
   - Configure vehicle information
   - Set service areas and working hours
   - Await admin verification

2. **Delivery Management**:
   - View available delivery assignments
   - Accept delivery tasks
   - Use integrated navigation
   - Update delivery status at each stage
   - Submit proof of delivery

3. **Financial Management**:
   - Track earnings per delivery
   - View payment history
   - Request payouts
   - Monitor performance metrics

### Admin Journey

1. **User Management**:
   - Verify vendor and driver accounts
   - Manage user permissions
   - Handle user support issues
   - Monitor suspicious activities

2. **Marketplace Management**:
   - Oversee categories and parts
   - Monitor vendor performance
   - Manage promotions and system-wide discounts
   - Handle dispute resolution

3. **Operational Oversight**:
   - Monitor order processing metrics
   - Track delivery efficiency
   - View system analytics
   - Manage system configuration

4. **Financial Administration**:
   - Process payout requests
   - Handle refund approvals
   - Monitor transaction logs
   - Generate financial reports

## Module Details

### Parts Management

The parts module is the core of the marketplace, featuring:

1. **Categories Structure**:
   - Hierarchical three-level category system (main category → subcategory → third-level)
   - Categories have commission rates that can be customized

2. **Part Details**:
   - Comprehensive information including specifications, compatibility, dimensions
   - Support for multiple images
   - Inventory tracking with low stock alerts
   - Price management with support for discounted pricing
   - Part conditions (NEW, USED, REFURBISHED, AFTERMARKET, OEM)

3. **Search and Discovery**:
   - Tag-based search functionality
   - Vehicle compatibility filtering
   - Recently viewed items tracking
   - Wishlist functionality

4. **Promotions**:
   - Vendors can create time-limited promotions
   - Multiple promotion types (DISCOUNT, BUNDLE, SPECIAL_OFFER, etc.)
   - Promotion code system for discounts

### Order Processing

Orders follow a well-defined flow:

1. **Order Creation**:
   - Customer initiates order with items from one vendor
   - System calculates subtotal, taxes, delivery fees
   - Promotion codes are applied if valid
   - Payment is processed

2. **Order Statuses**:
   - RECEIVED: Initial order state after successful payment
   - PROCESSING: Vendor is preparing the order
   - PREPARING: Items are being packaged
   - READY_FOR_PICKUP: Order is ready for driver pickup
   - IN_TRANSIT: Order is being delivered
   - DELIVERED: Order has been delivered to customer
   - COLLECTED: Order has been collected by customer (for collection orders)
   - CANCELLED: Order has been cancelled
   - RETURNED: Order has been returned
   - DISPUTED: Order is under dispute resolution

3. **Order Types**:
   - DELIVERY: Order delivered to customer's address
   - COLLECTION: Customer collects from vendor

4. **Calculations**:
   - Subtotal: Sum of all items (quantity × unit price)
   - Delivery Fee: Based on distance and order value
   - Tax: Calculated according to applicable rates
   - Discount: Applied from promotions or vouchers
   - Vendor Earning: Sale amount minus commission
   - Commission: Based on category commission rates

### Payment Flow

The platform supports multiple payment methods:

1. **Payment Methods**:
   - CARD: Credit/debit card payments
   - BANK_TRANSFER: Direct bank transfers
   - CASH_ON_DELIVERY: Cash payment upon delivery
   - MOBILE_MONEY: Mobile payment solutions

2. **Payment Process**:
   - Payment is initiated during order placement
   - Third-party payment gateway handles transactions
   - System records payment reference from gateway
   - Order proceeds only after successful payment verification
   - For COD, payment status updates upon delivery

3. **Payment Statuses**:
   - PENDING: Payment initiated but not confirmed
   - PAID: Payment successfully completed
   - FAILED: Payment attempt unsuccessful
   - REFUNDED: Full refund issued
   - PARTIALLY_REFUNDED: Partial refund issued

4. **Financial Operations**:
   - Vendor earnings are calculated with commissions deducted
   - Drivers receive delivery fees minus platform fees
   - Vendors and drivers can request payouts
   - Admin approves and processes payouts
   - System tracks all financial transactions

### Delivery System

The delivery system connects orders to available drivers:

1. **Delivery Assignment**:
   - System identifies nearby available drivers based on location
   - Delivery task is assigned to selected driver
   - Driver receives notification and accepts delivery
   - Real-time location tracking begins

2. **Delivery Status Flow**:
   - PENDING: Initial state before driver assignment
   - ASSIGNED: Driver has been assigned but not yet started
   - PICKUP_IN_PROGRESS: Driver is traveling to vendor location
   - PICKED_UP: Driver has collected the order from vendor
   - IN_TRANSIT: Driver is en route to delivery address
   - ARRIVED: Driver has arrived at delivery address
   - DELIVERED: Order successfully delivered to customer
   - FAILED: Delivery unsuccessful
   - CANCELLED: Delivery cancelled

3. **Location Services**:
   - Real-time driver location tracking
   - Geolocation-based driver searching
   - Route optimization
   - Delivery time estimation based on distance and traffic
   - Service area management

4. **Delivery Completion**:
   - Driver submits delivery proof (photo)
   - Customer receives delivery confirmation
   - Customer rates delivery experience
   - Driver earnings are calculated and credited

## Future Implementations

The following modules are planned for future development:

1. **Advanced Analytics**:
   - Sales trends analysis
   - Customer behavior insights
   - Inventory optimization recommendations
   - Driver performance metrics
   - Revenue forecasting

2. **Enhanced Admin Dashboard**:
   - Real-time system monitoring
   - Customizable reporting
   - User activity audit logs
   - System health checks

3. **Comprehensive Notification System**:
   - Push notifications
   - Email notifications
   - In-app messaging
   - Notification preferences management

4. **Refund Management**:
   - Automated refund processing
   - Partial refund handling
   - Return merchandise authorization
   - Refund reason analytics

5. **Driver Management Enhancements**:
   - Advanced route optimization
   - Bulk delivery assignment
   - Performance-based incentives
   - Scheduling and availability management

6. **Customer Loyalty Program**:
   - Points system
   - Tiered rewards
   - Referral incentives
   - Birthday/anniversary specials

7. **System Configuration Portal**:
   - Dynamic system settings management
   - Fee structure configuration
   - Service area expansion tools
   - Global promotion management