import { Injectable, inject } from '@angular/core'; // Added inject
import {
  collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, getDoc,
  DocumentReference, CollectionReference, QuerySnapshot, Firestore
} from '@angular/fire/firestore'; // Changed to @angular/fire/firestore
// import { db } from '../main'; // Removed db import
import { Customer } from './core/models/app.models';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private firestore: Firestore;
  private customersRef: CollectionReference;
  private invoicesRef: CollectionReference; // For checking associated invoices

  constructor() {
    this.firestore = inject(Firestore); // Moved inject here
    this.customersRef = collection(this.firestore, 'customers');
    this.invoicesRef = collection(this.firestore, 'invoices'); // Initialize invoices collection reference
  }

  async getCustomers(): Promise<Customer[]> {
    try {
      const snapshot = await getDocs(this.customersRef);
      return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Customer)); // Changed doc to docSnap for clarity
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

  async deleteCustomer(customerId: string): Promise<void> {
    try {
      // Check if the customer has any associated invoices
      // The 'customer' field in 'invoices' collection might store customer ID or an object.
      // We need to be flexible. Let's assume 'customerId' field exists for linking.
      // If 'customer' field could also be an object with an 'id' subfield, the query would be more complex.
      // For now, assuming invoices have a direct `customerId` field matching the customer's ID.
      const invoicesQuery = query(this.invoicesRef, where("customerId", "==", customerId));
      const invoicesSnapshot = await getDocs(invoicesQuery);

      if (!invoicesSnapshot.empty) {
        throw new Error(`CUSTOMER_HAS_INVOICES: This customer cannot be deleted because they have ${invoicesSnapshot.size} associated invoice(s).`);
      }

      // No associated invoices, proceed with deletion
      const customerDocRef = doc(this.customersRef, customerId);
      await deleteDoc(customerDocRef);
    } catch (error: any) {
      if (error.message?.startsWith('CUSTOMER_HAS_INVOICES:')) {
        console.warn(error.message);
      } else {
        console.error(`Error deleting customer ${customerId}:`, error);
      }
      throw error; // Re-throw all errors to be handled by the caller
    }
  }

  async updateCustomer(customerId: string, customerData: Partial<Customer>): Promise<void> {
    try {
      if (customerData.email) {
        // Email is being updated (or set for the first time if it was null)
        // Need to fetch the current customer's email to see if it actually changed.
        const currentCustomerDoc = await getDoc(doc(this.customersRef, customerId));
        const currentCustomer = currentCustomerDoc.data() as Customer | undefined;

        if (!currentCustomer) {
          throw new Error(`Customer with ID ${customerId} not found for update.`);
        }

        // Only check for duplicate if the email is actually different from the current one.
        if (customerData.email !== currentCustomer.email) {
          const q = query(this.customersRef, where("email", "==", customerData.email));
          const querySnapshot: QuerySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Check if the found email belongs to a *different* customer
            let isDuplicateForOtherCustomer = false;
            querySnapshot.forEach(docSnap => {
              if (docSnap.id !== customerId) {
                isDuplicateForOtherCustomer = true;
              }
            });

            if (isDuplicateForOtherCustomer) {
              throw new Error(`DUPLICATE_EMAIL_UPDATE: The email ${customerData.email} is already in use by another customer.`);
            }
          }
        }
      }

      const customerDocRef = doc(this.customersRef, customerId);
      await updateDoc(customerDocRef, customerData);
    } catch (error: any) {
      if (error.message?.startsWith('DUPLICATE_EMAIL_UPDATE:')) {
        console.warn(error.message);
      } else {
        console.error(`Error updating customer ${customerId}:`, error);
      }
      throw error; // Re-throw all errors
    }
  }
}
