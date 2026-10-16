# Booking Flow

`booking.json` is the WhatsApp Flow customers use to book. It has one booking screen: choosing a date fires `data_exchange`, and the endpoint answers with the same screen and that date's open times.

| Screen | Purpose |
| --- | --- |
| `BOOK` | Service heading, **Date** dropdown (reloads times), **Time** dropdown, **Your name**, *Confirm booking* |
| `SUCCESS` | Terminal confirmation; *Done* completes the Flow |

Time options use a Dropdown rather than radio buttons because a day can have more than 20 times (RadioButtonsGroup allows at most 20).

## Data contract

All requests reach `POST /whatsapp/flows` and are routed in `src/Controllers/Whatsapp/flows/bookingFlow.ts`. The `flow_token` identifies the booking context that the bot stored in Redis when it sent the Flow (`flow:<token>` → `{ phone, serviceId, serviceName, bookingId, customerName }`).

### `BOOK` screen data (every response that returns `BOOK`)

| Key | Type | Meaning |
| --- | --- | --- |
| `service_name` | string | Service being booked |
| `service_details` | string | e.g. `60 min · USD 15.00` |
| `dates` | `{id, title}[]` | `id` = local date `YYYY-MM-DD`, `title` = `Tue 20 Oct · 8 times` |
| `has_dates` | boolean | `false` hides the date dropdown (no availability) |
| `selected_date` | string | Date pre-selected in the dropdown |
| `slots` | `{id, title}[]` | `id` = slot start as an ISO timestamp (sent as-is to the scheduler hold), `title` = local `HH:mm` |
| `has_slots` | boolean | `false` hides the time dropdown |
| `slot_message` | string | Helper or error text shown above the times |
| `customer_name` | string | Pre-fills **Your name** |

`dates`/`slots` always contain at least one entry (a placeholder when empty) because dropdowns need a data source; the matching `has_*` flag hides them.

### Requests

| Action / trigger | Payload `data` | Response |
| --- | --- | --- |
| `INIT` | — | `BOOK` with the next 14 days that have availability; the first date is pre-selected with its times |
| `data_exchange`, `trigger: "date_selected"` | `{ date, name }` | `BOOK` with `selected_date = date` and that date's times |
| `data_exchange`, `trigger: "confirm"` | `{ date, slot, name }` | `SUCCESS` with `{ summary, booking_id }`, or `BOOK` with refreshed times and `slot_message` if the time was just taken |
| `BACK` | — | `BOOK` (same as `INIT`) |

When the user taps *Done*, WhatsApp sends an `nfm_reply` message to the webhook with `response_json` = `{ booking_id, flow_token }`.

## Publishing

1. WhatsApp Manager → **Account tools → Flows → Create Flow** (category *Appointment booking*), paste `booking.json` in the JSON editor and check there are no errors.
2. **Endpoint**: set the URI to `https://<public host>/whatsapp/flows`, connect the Meta app, upload the public key (see the main README) and run **Health check**.
3. Use **Preview → Request data** to try it against the running bot.
4. **Publish** the Flow and put its ID in `.env` as `WHATSAPP_BOOKING_FLOW_ID`.
