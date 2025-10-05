// In-memory token blacklist for logout functionality
// In production, consider using Redis or a database
class TokenBlacklist {
  private blacklistedTokens: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  add(token: string, expiresIn?: number): void {
    this.blacklistedTokens.add(token);
    
    // If expiresIn is provided, remove token after expiration
    if (expiresIn) {
      setTimeout(() => {
        this.blacklistedTokens.delete(token);
      }, expiresIn * 1000);
    }
  }

  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  remove(token: string): void {
    this.blacklistedTokens.delete(token);
  }

  clear(): void {
    this.blacklistedTokens.clear();
  }

  private cleanup(): void {
    // In a real implementation, you would check token expiration here
    // For now, we'll just keep the set as is since tokens are auto-removed
    console.log('Token blacklist cleanup completed');
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

export const tokenBlacklist = new TokenBlacklist();