# AA3DLab

Statiska mājaslapa + individuālā dizaina **vizualizācija**.

- `index.html` — publiskā lapa
- `designer.html` — vārds / fonts / krāsa / cauruma puse (caurums nav attēlā)
- Preview: vecā rīka ģeometrija — plāksnīte seko burtiem + pacelti burti
- Ražošana: Marshall (`font 72` · `body 16` · `padding 6`) pēc pasūtījuma izvēlēm

```bash
cd /Users/linda/Desktop/AA3DLab
python3 -m http.server 8765 --bind 127.0.0.1
```

http://127.0.0.1:8765/designer.html

Fonti: Overlock 900, Overlock 700, Comfortaa Bold, Lobster, Pacifico, Righteous.

## Admin Web Push (arī ar aizvērtu cilni / home screen)

1. Supabase SQL Editorī palaid `supabase/push-subscriptions.sql`.
2. Uzstādi secrets (atslēgas ir `.env.push.local`):

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="…" \
  VAPID_PRIVATE_KEY="…" \
  VAPID_SUBJECT="mailto:armands@pd.lv"
```

3. Deploy Edge Function:

```bash
supabase functions deploy admin-push --no-verify-jwt
```

4. Database → Webhooks → divi INSERT hooki uz `orders` un `messages` → Edge Function `admin-push` (ar service role auth header).
5. Adminā zvaniņš → **Ieslēgt paziņojumus**.
6. iPhone: Safari → Admin → Share → **Add to Home Screen**, tad atver no ikonas un ieslēdz paziņojumus (iOS atbalsta push tikai home screen PWA).
