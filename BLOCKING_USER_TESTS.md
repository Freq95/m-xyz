# Blocking Feature - User Test Checklist
**Date:** 2026-02-06
**Status:** All fixes applied ✅

---

## Quick Test Scenarios

### Setup
1. Create 2 test accounts: **User A** and **User B**
2. Have both users post content and comment

---

## ✅ Basic Blocking Tests

### Test 1: Block User
- [ ] User A goes to User B's profile
- [ ] User A clicks "Blocați utilizatorul" button
- [ ] Button changes to "Deblocați" instantly (optimistic update)
- [ ] Toast shows: "Nu vei mai vedea postările acestui utilizator"

**Expected:** Block happens instantly with feedback

---

### Test 2: Feed Filtering
- [ ] User A blocks User B
- [ ] User B's posts disappear from User A's feed
- [ ] User B's posts disappear from search results
- [ ] User B's comments disappear from all posts

**Expected:** User B becomes invisible to User A

---

### Test 3: Profile Access (NEW FIX)
- [ ] User A blocks User B
- [ ] User A tries to visit User B's profile `/profile/[id]`
- [ ] Shows: "Utilizatorul nu a fost găsit" (404)
- [ ] User B tries to visit User A's profile
- [ ] Also shows: 404

**Expected:** Neither user can see the other's profile

---

### Test 4: Post Detail (NEW FIX)
- [ ] User A blocks User B
- [ ] User A tries to view User B's post directly `/post/[id]`
- [ ] Shows: "Postarea nu a fost găsită" (404)
- [ ] User B tries to view User A's post
- [ ] Also shows: 404

**Expected:** Neither user can view the other's posts

---

### Test 5: Comments
- [ ] User A blocks User B
- [ ] User B tries to comment on User A's post
- [ ] Shows error: "Nu poți comenta pe această postare"
- [ ] User A tries to comment on User B's post
- [ ] Same error

**Expected:** Blocked users cannot comment on each other's posts

---

### Test 6: Notifications (NEW FIX)
**Before blocking:**
- [ ] User B comments on User A's post
- [ ] User A receives notification

**After blocking:**
- [ ] User A blocks User B
- [ ] User B comments on old post from User A
- [ ] User A does NOT receive notification
- [ ] User B replies to User A's old comment
- [ ] User A does NOT receive notification

**Expected:** No notifications from blocked users (even on old content)

---

### Test 7: Direct Messages
- [ ] User A blocks User B
- [ ] User B tries to send message to User A from profile
- [ ] Shows error: "Nu poți trimite mesaje către acest utilizator"
- [ ] Existing conversation (if any) hidden from both users
- [ ] User A tries to message User B
- [ ] Same error

**Expected:** Messaging completely disabled between blocked users

---

### Test 8: Saved Posts
- [ ] User A saves one of User B's posts
- [ ] User A blocks User B
- [ ] User A visits `/saved` page
- [ ] User B's saved post is no longer visible

**Expected:** Saved posts from blocked users are filtered out

---

## ✅ Unblocking Tests

### Test 9: Unblock User
- [ ] User A goes to User B's profile (currently shows 404)
- [ ] User A unblocks via direct URL or settings (if implemented)
- [ ] Wait 5 minutes (cache TTL) OR refresh app
- [ ] User B's profile becomes visible
- [ ] User B's posts appear in feed again
- [ ] User A can message User B again

**Expected:** Unblock restores all functionality (may take up to 5 min)

---

### Test 10: Quick Unblock
- [ ] User A blocks User B
- [ ] User A immediately unblocks User B
- [ ] Check feed - User B's posts should reappear within 30 seconds
- [ ] Check profile - User B's profile accessible

**Expected:** Unblock is relatively fast

---

## 🔄 Edge Cases

### Test 11: Self-Block Prevention
- [ ] User A goes to their own profile
- [ ] Block button should not appear OR be disabled

**Expected:** Cannot block yourself

### Test 12: Rate Limiting
- [ ] User A blocks 10 users rapidly
- [ ] Continue blocking more users
- [ ] After 60 blocks within an hour, shows: "Prea multe acțiuni. Încearcă din nou mai târziu."

**Expected:** Rate limit prevents spam blocking

### Test 13: Conversation History
- [ ] User A and User B have existing conversation with messages
- [ ] User A blocks User B
- [ ] User A goes to `/messages`
- [ ] Conversation with User B is hidden

**Expected:** Existing conversations hidden when blocked

### Test 14: Bidirectional Block
- [ ] User A blocks User B
- [ ] User B blocks User A
- [ ] Both users see 404 on each other's profiles
- [ ] Neither can send messages

**Expected:** Both directions work independently

---

## 🚀 Quick Smoke Test (5 min)

**Run this for fast validation:**

1. ✅ Block a user → profile shows 404
2. ✅ Blocked user's posts disappear from feed
3. ✅ Cannot send message to blocked user
4. ✅ Unblock → profile becomes visible
5. ✅ No notifications from blocked users

**If all 5 pass → Blocking feature is working correctly**

---

## 📝 Test Results Template

```
Date: _______
Tester: _______

[ ] Test 1: Block User
[ ] Test 2: Feed Filtering
[ ] Test 3: Profile Access (NEW FIX)
[ ] Test 4: Post Detail (NEW FIX)
[ ] Test 5: Comments
[ ] Test 6: Notifications (NEW FIX)
[ ] Test 7: Direct Messages
[ ] Test 8: Saved Posts
[ ] Test 9: Unblock User
[ ] Test 10: Quick Unblock

Edge Cases:
[ ] Test 11: Self-Block Prevention
[ ] Test 12: Rate Limiting
[ ] Test 13: Conversation History
[ ] Test 14: Bidirectional Block

Issues found:
_________________________
_________________________
_________________________
```

---

## 🐛 Known Limitations

1. **Cache Delay:** Unblock takes up to 5 minutes to fully propagate (Redis cache TTL)
2. **No Block List UI:** Users cannot view list of who they've blocked (could add to settings)
3. **No Bulk Unblock:** Must unblock users one by one

---

**All critical fixes applied. Ready for testing!**
