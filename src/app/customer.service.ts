import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, DocumentReference, CollectionReference } from 'firebase/firestore';
import { db } from '../main';
import { Customer } from './core/models/app.models'; // Corrected path

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private customersRef: CollectionReference;

  constructor() {
    this.customersRef = collection(db, 'customers');
  }

  async getCustomers(): Promise<Customer[]> {
    try {
      const snapshot = await getDocs(this.customersRef);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    } catch (error) {
      console.error("Error fetching customers:", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  async addCustomer(customer: Omit<Customer, 'id'>): Promise<string> {
    try {
      const docRef: DocumentReference = await addDoc(this.customersRef, customer);
      return docRef.id;
    } catch (error) {
      console.error("Error adding customer:", error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }
}
