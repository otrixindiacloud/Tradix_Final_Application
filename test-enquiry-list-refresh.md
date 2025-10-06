# Testing Enquiry Status Update in Enquiries Table

## Current Implementation

The enquiries page uses React Query with this configuration:

```typescript
const { data: enquiries = [], isLoading, error } = useQuery({
  queryKey: ["/api/enquiries", filters],
  queryFn: async () => {
    // Fetch enquiries with filters
  },
});
```

## Status Update Flow

When you convert an enquiry to quotation:

1. **Backend** updates the enquiry status to "Quoted" ✅
2. **Frontend** invalidates these queries:
   - `["/api/enquiries", id]` - specific enquiry
   - `["/api/enquiries"]` - all enquiries (without filters)
   - All quotation queries

3. **React Query** automatically refetches the invalidated queries
4. **UI** re-renders with fresh data

## How to Verify

### Step 1: Open Enquiries Page
1. Navigate to `/enquiries`
2. Note an enquiry with status "New" or "In Progress"
3. Remember its Enquiry ID (e.g., ENQ-2024-189)

### Step 2: Convert to Quotation
1. Click on the enquiry to open details
2. Click "Convert to Quotation" button
3. Confirm the conversion
4. You'll see: "Quotation created successfully and enquiry status updated to 'Quoted'"
5. You'll be redirected to the new quotation page

### Step 3: Check Status in Table
1. Navigate back to `/enquiries` (click "Enquiries" in the sidebar)
2. Find the same enquiry by Enquiry ID
3. ✅ The status badge should now show "Quoted" with green styling
4. ✅ The "Quoted" count in the statistics cards should increase by 1
5. ✅ The "New" or "In Progress" count should decrease by 1

## Potential Issues

### Issue 1: Query Key Mismatch
The enquiries page query includes `filters` in the key: `["/api/enquiries", filters]`

Our invalidation uses: `["/api/enquiries"]` (without specific filters)

**Solution:** This should work because React Query invalidates all queries that START with the key. So `["/api/enquiries"]` will invalidate `["/api/enquiries", {}]`, `["/api/enquiries", {status: "New"}]`, etc.

### Issue 2: Cache Staleness
If React Query thinks the data is still fresh, it might not refetch.

**Solution:** We're using `invalidateQueries` which forces a refetch regardless of staleness.

### Issue 3: Browser Navigation Cache
If you use the browser's back button instead of clicking the navigation link, the browser might show cached HTML.

**Solution:** Use the app's navigation (sidebar links) instead of browser back button.

## Current Code Verification

The invalidation code in `enquiry-detail.tsx`:

```typescript
onSuccess: (quotation) => {
  // Invalidate enquiry queries to update the status
  queryClient.invalidateQueries({ queryKey: ["/api/enquiries", id] });
  queryClient.invalidateQueries({ queryKey: ["/api/enquiries"] });
  
  // Navigate to quotation
  navigate(`/quotations/${quotation.id}`);
}
```

This SHOULD work correctly because:
1. ✅ It invalidates the specific enquiry
2. ✅ It invalidates all enquiry list queries
3. ✅ React Query will refetch when you navigate back to the enquiries page

## If It Still Doesn't Work

Try these steps:

1. **Hard Refresh:** Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

2. **Check Network Tab:**
   - Open browser DevTools (F12)
   - Go to Network tab
   - Navigate back to enquiries page
   - Look for a request to `/api/enquiries`
   - Check the response - does it show the updated status?

3. **Check React Query DevTools:**
   - If installed, check the React Query DevTools
   - Look at the query state for `["/api/enquiries", ...]`
   - Is it showing fresh data?

4. **Manual Refresh:**
   - Click the "Retry" button if there's an error
   - Or refresh the page

## Expected Result

✅ **SUCCESS:** When you navigate back to the enquiries list after conversion:
- The enquiry's status badge shows "Quoted" (green)
- The status statistics at the top are updated
- No manual refresh needed
