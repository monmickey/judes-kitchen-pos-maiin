# Timestamps and Timezone Integration Examples

This document provides complete, practical code examples for configuring client and server operations using UTC timestamps and displaying them in each user's local timezone.

---

## 1. Inserting Records

When inserting records into the database, always let the database handle timestamps using default values (`DEFAULT NOW()`) or generate UTC strings on the client/backend before saving. Do **NOT** pass local timestamps (like Indian time or Dubai time) directly.

### A. Client-Side (Vite / Next.js with Supabase Client)
```typescript
import { supabase } from '@/lib/supabaseClient';

export async function createOrder(orderData: { customerId: string; total: number }) {
  const { data, error } = await supabase
    .from('orders')
    .insert([
      {
        customer_id: orderData.customerId,
        grand_total: orderData.total,
        // Option 1: Leave 'created_at' and 'updated_at' out so database defaults are used.
        // Option 2: Explicitly pass UTC ISO 8601 timestamp:
        created_at: new Date().toISOString(), // Always outputs UTC: "2026-06-20T08:00:00.000Z"
        updated_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    console.error('Failed to create order:', error);
    throw error;
  }
  return data[0];
}
```

### B. Backend API (Node.js/Express with Prisma)
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Express Route handler
app.post('/api/orders', async (req, res) => {
  try {
    const { customerId, total } = req.body;
    
    const newOrder = await prisma.order.create({
      data: {
        customerId,
        grandTotal: total,
        // Prisma will map this to TIMESTAMPTZ default NOW() on PostgreSQL automatically,
        // but if setting manually, use new Date() which generates a UTC timestamp in JS.
        createdAt: new Date(), 
        updatedAt: new Date(),
      },
    });

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 2. Fetching Records

When fetching from Supabase, Postgres returns dates as UTC ISO strings (e.g., `2026-06-20T08:00:00Z`). We parse them on the client.

```typescript
import { supabase } from '@/lib/supabaseClient';

export async function fetchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data; // timestamps are returned as strings: e.g. "2026-06-20T08:00:00+00:00"
}
```

---

## 3. Displaying Zoned Date and Time

Import the date utility file (`src/utils/date.ts`) to format the timestamps. The formatting automatically detects the user's local timezone (e.g., `Asia/Kolkata` for Indian users, `Asia/Dubai` for Dubai users) and converts the UTC value.

### Display Component (React / Vite)
```tsx
import React from 'react';
import { formatDateTime, formatDate, formatTime, getUserTimezone } from '../utils/date';

interface OrderRowProps {
  order: {
    id: string;
    invoiceNo: string;
    grandTotal: number;
    createdAt: string; // e.g., "2026-06-20T08:00:00Z"
  };
}

export const OrderRow: React.FC<OrderRowProps> = ({ order }) => {
  const detectedTimezone = getUserTimezone();

  return (
    <tr className="border-b hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-900">{order.invoiceNo}</td>
      <td className="px-6 py-4">${order.grandTotal.toFixed(2)}</td>
      {/* Example 1: Full Date & Time formatted based on user's timezone */}
      <td className="px-6 py-4 text-slate-600">
        {formatDateTime(order.createdAt)}
      </td>
      {/* Example 2: Date only */}
      <td className="px-6 py-4 text-slate-500">
        {formatDate(order.createdAt)}
      </td>
      {/* Example 3: Time only */}
      <td className="px-6 py-4 text-slate-500 font-semibold">
        {formatTime(order.createdAt)}
      </td>
      <td className="px-6 py-4 text-xs text-blue-600 font-mono">
        ({detectedTimezone})
      </td>
    </tr>
  );
};
```

#### Timezone Output Table:
Given a database UTC timestamp of `2026-06-20T08:00:00Z`:

| User Location | User Timezone | Display Output (`formatTime`) | Display Output (`formatDateTime`) |
| :--- | :--- | :--- | :--- |
| **India** | `Asia/Kolkata` | `1:30 PM IST` | `June 20, 2026, 1:30 PM IST` |
| **Dubai** | `Asia/Dubai` | `12:00 PM GST` | `June 20, 2026, 12:00 PM GST` |
| **UK** | `Europe/London` | `9:00 AM BST` | `June 20, 2026, 9:00 AM BST` |
| **US (New York)** | `America/New_York` | `4:00 AM EDT` | `June 20, 2026, 4:00 AM EDT` |

---

## 4. Preventing Hydration Mismatches in Next.js (SSR / React Server Components)

### The Hydration Problem:
In SSR environments (like Next.js), the server executes the code (running in UTC timezone on Vercel/Docker) and generates HTML. The client's browser receives the HTML and runs the React hydration phase in the *user's* timezone (e.g. `Asia/Kolkata`). 
If there's a difference in rendered output, React throws a **Hydration Mismatch Warning**:
`Text content did not match. Server: "8:00 AM GMT" Client: "1:30 PM IST"`.

### The Solution:
Create a `<LocalTime>` wrapper component that postpones date rendering until the client-side component mounts.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/utils/date';

interface LocalTimeProps {
  utcTimestamp: string | Date;
  fallback?: string;
}

export function LocalTime({ utcTimestamp, fallback = 'Loading time...' }: LocalTimeProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Return server-safe placeholder to avoid layout shifts or mismatches
    return <span className="text-slate-400">{fallback}</span>;
  }

  // Runs strictly client-side, rendering correct local time
  return <span>{formatDateTime(utcTimestamp)}</span>;
}
```

---

## 5. Instant Real-time Synchronization across Countries

To ensure updates from one user are reflected instantly for all other users in their respective local timezones, subscribe to Supabase PostgreSQL real-time replication.

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { LocalTime } from './LocalTime';

export function RealTimeDashboard() {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch current list of records
    const loadRecords = async () => {
      const { data } = await supabase.from('example_table').select('*');
      if (data) setRecords(data);
    };
    loadRecords();

    // 2. Subscribe to real-time events
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'example_table' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRecords((current) => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setRecords((current) =>
              current.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setRecords((current) =>
              current.filter((r) => r.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-6 bg-slate-900 text-white rounded-lg shadow-xl">
      <h2 className="text-xl font-bold mb-4">Instant System Records</h2>
      <ul className="space-y-2">
        {records.map((record) => (
          <li key={record.id} className="p-3 bg-slate-800 rounded flex justify-between items-center">
            <span>{record.data}</span>
            <span className="text-sm font-mono text-cyan-400">
              {/* This automatically converts the real-time record.updated_at to user's local timezone */}
              <LocalTime utcTimestamp={record.updated_at} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```
