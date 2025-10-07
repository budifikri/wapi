import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Generates a random 8-character key with uppercase letters and numbers
 * @returns {string} Random 8-character key
 */
const generateDeviceKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Creates a new device record in the database
 * @param {string} sessionId - The session ID
 * @param {string} userId - The ID of the user who owns this device
 * @param {string} number - The WhatsApp number
 * @param {string} status - The current status of the device
 * @returns {Promise<Object>} The device record
 */
const createDevice = async (sessionId: string, userId: string, number: string, status: string = 'unknown') => {
  // Generate unique key and UUID
  const key = generateDeviceKey();
  const uuid = uuidv4();

  return await prisma.devices.create({
    data: {
      uuid,
      key,
      sessionId,
      number,
      status,
      userId,
      updatedAt: new Date()
    }
  });
};

/**
 * Updates a device record in the database
 * @param {string} sessionId - The session ID
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} The updated device record
 */
const updateDevice = async (sessionId: string, data: any) => {
  // Ensure updatedAt is set when updating
  data.updatedAt = new Date();
  return await prisma.devices.update({
    where: { sessionId },
    data
  });
};

/**
 * Gets a device record by its session ID
 * @param {string} sessionId - The unique identifier for the device
 * @returns {Promise<Object|null>} The device record or null if not found
 */
const getDeviceBySessionId = async (sessionId: string) => {
  return await prisma.devices.findUnique({
    where: {
      sessionId: sessionId
    }
  });
};

/**
 * Gets a device record by its key
 * @param {string} deviceKey - The unique key for the device
 * @returns {Promise<Object|null>} The device record or null if not found
 */
const getDeviceByKey = async (deviceKey: string) => {
  return await prisma.devices.findUnique({
    where: {
      key: deviceKey
    }
  });
};

/**
 * Verifies if a device belongs to a specific user
 * @param {string} sessionId - The unique identifier for the device
 * @param {number} userId - The ID of the user
 * @returns {Promise<boolean>} True if the device belongs to the user, false otherwise
 */
const verifyDeviceOwnership = async (sessionId: string, userId: string) => {
  const device = await prisma.devices.findUnique({
    where: {
      sessionId: sessionId
    }
  });

  return device && device.userId === userId;
};

/**
 * Updates the status of a device
 * @param {string} sessionId - The unique identifier for the device
 * @param {string} status - The new status of the device
 * @returns {Promise<Object>} The updated device record
 */
const updateDeviceStatus = async (sessionId: string, status: string) => {
  return await prisma.devices.update({
    where: {
      sessionId: sessionId
    },
    data: {
      status: status,
      updatedAt: new Date()
    }
  });
};

/**
 * Updates the ready state of a device
 * @param {string} sessionId - The unique identifier for the device
 * @param {boolean} ready - The ready state of the device
 * @returns {Promise<Object>} The updated device record
 */
const updateDeviceReadyState = async (sessionId: string, ready: boolean) => {
  return await prisma.devices.update({
    where: {
      sessionId: sessionId
    },
    data: {
      ready: ready,
      updatedAt: new Date()
    }
  });
};

/**
 * Deletes a device record
 * @param {string} sessionId - The unique identifier for the device
 * @returns {Promise<Object>} The deleted device record
 */
const deleteDevice = async (sessionId: string) => {
  return await prisma.devices.delete({
    where: {
      sessionId: sessionId
    }
  });
};

/**
 * Saves a message to the database
 * @param {string} deviceKey - The device key associated with this message
 * @param {any} messageData - The message data from the webhook
 * @returns {Promise<Object>} The saved message record
 */
const saveMessage = async (deviceKey: string, messageData: any) => {
  // Extract relevant fields from the message data
  // Handle the message structure from webhook properly
  let message = messageData;
  
  // If the messageData contains _data property, use that as the actual message
  if (messageData && messageData._data) {
    message = messageData._data;
  } else if (messageData && messageData.message && messageData.message._data) {
    // Handle case where message is nested: { message: { _data: {...} } }
    message = messageData.message._data;
  } else if (messageData && messageData.message) {
    // Handle case where message is nested: { message: {...} }
    message = messageData.message;
  }
  
  // Generate a unique UUID for the message
  const uuid = uuidv4();
  
  // Create message record
  return await prisma.messages.create({
    data: {
      uuid,
      deviceKey,
      messageId: message.id?._serialized || message.id || '',
      read: message.ack || 0,
      noTujuan: message.to?.user || message.to || null,
      text: message.body || message.text || '',
      isGroup: message.isGroup || false,
      secure: message.isSentCagPollCreation || false,
      timestamp: message.t || message.timestamp || 0, // Use 0 as default instead of null for timestamp
      from: message.from?.user || message.from || null,
      fromMe: message.fromMe || false,
      to: message.to?.user || message.to || null,
      type: message.type || '',
      updatedAt: new Date()
    }
  });
};

/**
 * Gets messages for a specific device
 * @param {string} deviceKey - The device key
 * @returns {Promise<Object[]>} Array of messages for the device
 */
const getMessagesByDevice = async (deviceKey: string) => {
  return await prisma.messages.findMany({
    where: {
      deviceKey: deviceKey
    },
    orderBy: {
      timestamp: 'desc'
    }
  });
};

/**
 * Saves or updates a contact in the database
 * @param {string} deviceKey - The device key associated with this contact
 * @param {any} contactData - The contact data from the API response
 * @returns {Promise<Object>} The saved/updated contact record
 */
const saveContact = async (deviceKey: string, contactData: any) => {
  // Generate a unique UUID for the contact
  const uuid = uuidv4();
  
  // Determine the contact ID - try multiple possible fields
  let contactId = contactData.id?._serialized || contactData.id || contactData.contactId || contactData.number || uuid;
  
  // Try to extract number from various possible fields
  let number = contactData.number || contactData.phoneNumber || contactData.phone || contactData.id?.user || null;
  if (!number && contactData.id && typeof contactData.id === 'string') {
    // If id looks like a serialized WhatsApp ID, extract the number
    const match = contactData.id.match(/(\d+)@/);
    if (match) {
      number = match[1];
    }
  }
  
  // Ensure contactId is a string and formatted properly
  if (typeof contactId !== 'string') {
    contactId = String(contactId);
  }
  
  // Check if contact already exists
  const existingContact = await prisma.contacts.findUnique({
    where: { contactId: contactId }
  });

  if (existingContact) {
    // Update existing contact
    return await prisma.contacts.update({
      where: { contactId: contactId },
      data: {
        deviceKey,
        contactName: contactData.name || contactData.contactName || contactData.pushname || null,
        isBusiness: contactData.isBusiness || false,
        isGroup: contactData.isGroup || false,
        isUser: contactData.isUser || true,
        name: contactData.name || contactData.pushname || null,
        number: number,
        serialized: contactData.id?._serialized || contactData.id || null,
        shortName: contactData.shortName || contactData.shortname || null,
        businessProfile: contactData.businessProfile || null,
        description: contactData.businessProfile?.description || contactData.description || null,
        email: contactData.businessProfile?.email || contactData.email || null,
        website: Array.isArray(contactData.businessProfile?.website) 
          ? contactData.businessProfile.website.map((site: any) => typeof site === 'string' ? site : site?.url).filter((url: any) => url).join(', ') || null
          : typeof contactData.businessProfile?.website === 'string'
            ? contactData.businessProfile.website
            : contactData.businessProfile?.website || contactData.website || null,
        address: contactData.businessProfile?.address || contactData.address || null,
        latitude: contactData.businessProfile?.latitude || contactData.lat || null,
        longitude: contactData.businessProfile?.longitude || contactData.lng || null,
        categories: Array.isArray(contactData.businessProfile?.categories)
          ? contactData.businessProfile.categories  // categories is Json type, store as-is
          : contactData.businessProfile?.categories || contactData.categories || null,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new contact
    return await prisma.contacts.create({
      data: {
        uuid,
        deviceKey,
        contactId,
        contactName: contactData.name || contactData.contactName || contactData.pushname || null,
        isBusiness: contactData.isBusiness || false,
        isGroup: contactData.isGroup || false,
        isUser: contactData.isUser || true,
        name: contactData.name || contactData.pushname || null,
        number: number,
        serialized: contactData.id?._serialized || contactData.id || null,
        shortName: contactData.shortName || contactData.shortname || null,
        businessProfile: contactData.businessProfile || null,
        description: contactData.businessProfile?.description || contactData.description || null,
        email: contactData.businessProfile?.email || contactData.email || null,
        website: Array.isArray(contactData.businessProfile?.website) 
          ? contactData.businessProfile.website.map((site: any) => typeof site === 'string' ? site : site?.url).filter((url: any) => url).join(', ') || null
          : typeof contactData.businessProfile?.website === 'string'
            ? contactData.businessProfile.website
            : contactData.businessProfile?.website || contactData.website || null,
        address: contactData.businessProfile?.address || contactData.address || null,
        latitude: contactData.businessProfile?.latitude || contactData.lat || null,
        longitude: contactData.businessProfile?.longitude || contactData.lng || null,
        categories: Array.isArray(contactData.businessProfile?.categories)
          ? contactData.businessProfile.categories  // categories is Json type, store as-is
          : contactData.businessProfile?.categories || contactData.categories || null,
        updatedAt: new Date()
      }
    });
  }
};

/**
 * Saves multiple contacts to the database (only those with @c.us suffix)
 * @param {string} deviceKey - The device key associated with these contacts
 * @param {any[]} contactsData - Array of contact data from the API response
 * @returns {Promise<Object[]>} Array of saved/updated contact records
 */
const saveContacts = async (deviceKey: string, contactsData: any[]) => {
  const results: any[] = [];
  
  for (const contact of contactsData) {
    try {
      // Filter to only process contacts with @c.us suffix (regular WhatsApp users)
      // The contactId could be in various fields like id, id._serialized, contactId, etc.
      let contactId = contact.id?._serialized || contact.id || contact.contactId || contact.number || '';
      
      // Convert to string if needed
      if (typeof contactId !== 'string') {
        contactId = String(contactId);
      }
      
      // Only save contacts that have the @c.us suffix
      if (contactId.includes('@c.us')) {
        const result = await saveContact(deviceKey, contact);
        results.push(result);
      } else {
        console.log(`Skipping contact with ID ${contactId} - not a user contact (@c.us)`);
      }
    } catch (error) {
      console.error("Error saving contact:", error);
    }
  }
  
  return results;
};

/**
 * Gets contacts for a specific device
 * @param {string} deviceKey - The device key
 * @returns {Promise<Object[]>} Array of contacts for the device
 */
const getContactsByDevice = async (deviceKey: string) => {
  return await prisma.contacts.findMany({
    where: {
      deviceKey: deviceKey
    },
    orderBy: {
      name: 'asc'
    }
  });
};

export {
  createDevice,
  updateDevice,
  getDeviceBySessionId,
  getDeviceByKey,
  verifyDeviceOwnership,
  updateDeviceStatus,
  updateDeviceReadyState,
  deleteDevice,
  saveMessage,
  getMessagesByDevice,
  saveContact,
  saveContacts,
  getContactsByDevice
};