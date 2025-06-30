import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection, collectionData, deleteDoc, doc, orderBy, query, updateDoc, CollectionReference } from '@angular/fire/firestore'; // Added CollectionReference
import { Observable } from 'rxjs';
import { Vendor } from './core/models/app.models';

@Injectable({
  providedIn: 'root'
})
export class VendorService {
  private firestore: Firestore;
  private vendorsCollection: CollectionReference<Vendor>; // Declare type

  constructor() {
    this.firestore = inject(Firestore);
    // Initialize collection reference here after firestore is injected
    this.vendorsCollection = collection(this.firestore, 'vendors') as CollectionReference<Vendor>;
  }

  // Create: Add a new vendor
  async addVendor(vendorData: Omit<Vendor, 'id'>): Promise<string> {
    try {
      // Consider adding a check for unique vendor name here if needed
      const docRef = await addDoc(this.vendorsCollection, vendorData);
      return docRef.id;
    } catch (error) {
      console.error("Error adding vendor:", error);
      throw error;
    }
  }

  // Read: Get all vendors, ordered by name
  getVendors(): Observable<Vendor[]> {
    try {
      const q = query(this.vendorsCollection, orderBy('name'));
      // Firestore v9 collectionData returns Observable<DocumentData[]>.
      // We need to cast it to Observable<Vendor[]> if idField is used.
      return collectionData(q, { idField: 'id' }) as Observable<Vendor[]>;
    } catch (error) {
      console.error("Error getting vendors:", error);
      throw error;
    }
  }

  // Update: Update an existing vendor
  async updateVendor(vendorId: string, vendorData: Partial<Vendor>): Promise<void> {
    try {
      const vendorDocRef = doc(this.firestore, 'vendors', vendorId);
      await updateDoc(vendorDocRef, vendorData);
    } catch (error) {
      console.error("Error updating vendor:", error);
      throw error;
    }
  }

  // Delete: Delete a vendor
  async deleteVendor(vendorId: string): Promise<void> {
    try {
      // Note: We are not currently checking if this vendor is associated with any expenses.
      // This could be added as a feature later if needed (similar to customer-invoice check).
      const vendorDocRef = doc(this.firestore, 'vendors', vendorId);
      await deleteDoc(vendorDocRef);
    } catch (error) {
      console.error("Error deleting vendor:", error);
      throw error;
    }
  }
}
