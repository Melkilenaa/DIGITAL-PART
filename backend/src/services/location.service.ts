import { PrismaClient } from '@prisma/client';
import { BadRequestException, NotFoundException } from '../utils/exceptions.util';

export class LocationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Origin latitude
   * @param lon1 Origin longitude
   * @param lat2 Destination latitude
   * @param lon2 Destination longitude
   * @returns Distance in kilometers
   */
  calculateDistance(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      return 0;
    }
    
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    
    return parseFloat(distance.toFixed(2));
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Calculate delivery fee based on distance and order value
   * @param distance Distance in kilometers
   * @param orderValue Total order value
   * @param isRush Whether this is a rush delivery
   * @returns Delivery fee in Naira
   */
  calculateDeliveryFee(distance: number, orderValue: number, isRush: boolean = false): number {
    // Base fee
    let baseFee = 500; // 500 NGN base fee
    
    // Distance fee: 100 NGN per km after first 3 km
    const distanceFee = distance > 3 ? Math.round((distance - 3) * 100) : 0;
    
    // Rush hour fee if applicable (20% extra)
    const rushFee = isRush ? Math.round((baseFee + distanceFee) * 0.2) : 0;
    
    // Calculate total fee
    let totalFee = baseFee + distanceFee + rushFee;
    
    // Discount for large orders
    if (orderValue > 50000) { // Orders above 50,000 NGN
      totalFee = Math.round(totalFee * 0.9); // 10% discount on delivery
    } else if (orderValue > 20000) { // Orders above 20,000 NGN
      totalFee = Math.round(totalFee * 0.95); // 5% discount on delivery
    }
    
    return Math.max(totalFee, 500); // Minimum 500 NGN
  }

  /**
   * Check if a location is within service area
   * @param lat Latitude to check
   * @param lon Longitude to check
   * @param serviceArea Service area to check against
   * @returns Boolean indicating if location is in service area
   */
  isWithinServiceArea(lat: number, lon: number, serviceArea: any): boolean {
    if (!serviceArea || !serviceArea.latitude || !serviceArea.longitude || !serviceArea.radius) {
      return false;
    }
    
    const distance = this.calculateDistance(
      lat, 
      lon, 
      serviceArea.latitude, 
      serviceArea.longitude
    );
    
    return distance <= serviceArea.radius;
  }

  /**
   * Estimate delivery time based on distance and current traffic
   * @param distance Distance in kilometers
   * @param trafficFactor Traffic factor (1.0 normal, >1.0 heavy traffic)
   * @returns Estimated delivery time in minutes
   */
  estimateDeliveryTime(distance: number, trafficFactor: number = 1.0): number {
    // Base calculation: 30 km/h average speed + 15 min for pickup
    const pickupTimeMinutes = 15;
    const averageSpeed = 30; // km/h
    
    // Calculate travel time in minutes, adjusted for traffic
    const travelTimeMinutes = (distance / averageSpeed) * 60 * trafficFactor;
    
    return Math.round(pickupTimeMinutes + travelTimeMinutes);
  }

  /**
   * Find nearest available drivers to a location
   * @param lat Pickup latitude
   * @param lon Pickup longitude
   * @param maxDistance Maximum distance to search for drivers (km)
   * @returns Array of drivers with distance and estimated arrival time
   */
  async findNearestDrivers(lat: number, lon: number, maxDistance: number = 10) {
    const availableDrivers = await this.prisma.driver.findMany({
      where: {
        isAvailable: true,
        isVerified: true,
        latitude: { not: null },
        longitude: { not: null }
      }
    });
    
    const driversWithDistance = availableDrivers.map(driver => {
      const distance = this.calculateDistance(
        lat,
        lon,
        driver.latitude,
        driver.longitude
      );
      
      if (distance <= maxDistance) {
        const estimatedArrival = this.estimateDeliveryTime(distance, 1.0);
        return {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          distance,
          estimatedArrival,
          vehicleType: driver.vehicleType,
          rating: driver.rating
        };
      }
      return null;
    }).filter(Boolean);
    
    // Sort by distance
    return driversWithDistance.sort((a, b) => {
      if (!a) return 1;  // null values come last
      if (!b) return -1; // null values come first
      return a.distance - b.distance;
    });
  }

  /**
   * Get service areas for a specific location
   * This would typically query a database of defined service areas
   * @returns Array of service areas
   */
  async getServiceAreas() {
    // Sample implementation - in real world, this would query the database
    return [
      { id: 'lagos', name: 'Lagos Mainland', latitude: 6.5244, longitude: 3.3792, radius: 15 },
      { id: 'lagos_island', name: 'Lagos Island', latitude: 6.4541, longitude: 3.4205, radius: 10 },
      { id: 'ikeja', name: 'Ikeja', latitude: 6.6018, longitude: 3.3515, radius: 8 },
      { id: 'lekki', name: 'Lekki', latitude: 6.4698, longitude: 3.5852, radius: 12 }
    ];
  }

  /**
   * Get map data for rendering a delivery route
   * @param originLat Origin latitude
   * @param originLon Origin longitude
   * @param destLat Destination latitude
   * @param destLon Destination longitude
   * @returns Map data object for frontend rendering
   */
  getMapRenderingData(originLat: number, originLon: number, destLat: number, destLon: number) {
    return {
      origin: { lat: originLat, lng: originLon },
      destination: { lat: destLat, lng: destLon },
      center: {
        lat: (originLat + destLat) / 2,
        lng: (originLon + destLon) / 2
      },
      zoom: 12,
      distance: this.calculateDistance(originLat, originLon, destLat, destLon)
    };
  }
}

export default new LocationService(new PrismaClient());