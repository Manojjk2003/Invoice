import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, query, where, DocumentReference, CollectionReference, QuerySnapshot } from 'firebase/firestore';
import { db } from '../main';
import { Customer } from './core/models/app.models';

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
      // Check if customer with the same email already exists
      const q = query(this.customersRef, where("email", "==", customer.email));
      const querySnapshot: QuerySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Customer with this email already exists
        // querySnapshot.docs.forEach(doc => console.log(doc.id, " => ", doc.data())); // For debugging
        throw new Error(`DUPLICATE_EMAIL: A customer with the email ${customer.email} already exists.`);
      }

      // No duplicate, proceed to add the new customer
      const docRef: DocumentReference = await addDoc(this.customersRef, customer);
      return docRef.id;
    } catch (error: any) {
      // Log the specific error type if it's our custom one, otherwise log generic
      if (error.message?.startsWith('DUPLICATE_EMAIL:')) {
        console.warn(error.message); // Log as warning, as it's a validation error
      } else {
        console.error("Error adding customer:", error);
      }
      throw error; // Re-throw the error to be handled by the caller
    }
  }
}
