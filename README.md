# http-accept-charset-header-parse

Parses the HTTP `Accept-Charset` header into character sets with quality factors, for server-side response negotiation.

## Usage

```js
import { parseAcceptCharset, pickCharset, formatAcceptCharset } from 'http-accept-charset-header-parse';

const accepted = parseAcceptCharset('utf-8;q=0.9, iso-8859-1;q=0.1, *;q=0');

const chosen = pickCharset(accepted, ['utf-8', 'iso-8859-1', 'windows-1252']);
// => 'UTF-8'

const header = formatAcceptCharset(accepted);
// => 'UTF-8;q=0.9, ISO-8859-1;q=0.1, *;q=0'
```

`parseAcceptCharset(header)` returns an array of `{ charset, q }` in header order, with charset names upper-cased and `q` clamped to `[0,1]`. An absent `q` defaults to `1`.

`pickCharset(accepted, offered)` returns the best charset string from the server's offered list, honouring `*` as a wildcard and skipping `q=0` entries. On ties it picks the first offered, giving the server a deterministic tie-break. Returns `null` when nothing matches.

`formatAcceptCharset(specs)` serialises specs back to a header string, omitting `q=1`.

## Why

Servers that vary their response encoding need to read `Accept-Charset` and pick one charset from what they can produce. The parsing rules are fiddly enough — default `q`, `q=0` meaning "not acceptable", the `*` wildcard, case-insensitive names — that doing it inline invites bugs. This library does exactly that and nothing else.

The trade-off: we do **not** implement the RFC 7231 special case where an absent `Accept-Charset` header implies a default of `ISO-8859-1;q=1`. That rule is about header *absence*, and folding it into a parser that also handles header *content* causes exactly the kind of double-meaning bug that breaks callers. If the header is absent, `parseAcceptCharset(null)` returns `[]`; callers who want the ISO-8859-1 fallback should pass `null` and handle it themselves.

## Edge cases worth knowing

- Charset names are upper-cased on output so `utf-8` and `UTF-8` compare equal downstream.
- A non-numeric `q` value (e.g. `q=banana`) falls back to `1` rather than `0`. An explicit charset with a broken quality should not silently become unacceptable.
- `q` is clamped: `q=1.5` becomes `1`, `q=-1` becomes `0`.
