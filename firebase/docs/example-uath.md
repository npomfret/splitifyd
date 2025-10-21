# Firebase curls for a dev instance

## login

```bash
curl 'http://127.0.0.1:7002/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'DNT: 1' \
  -H 'Origin: http://localhost:7005' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: cross-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'X-Client-Version: Chrome/JsCore/12.0.0/FirebaseCore-web' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"returnSecureToken":true,"email":"test1@test.com","password":"passwordpass","clientType":"CLIENT_TYPE_WEB"}'
```

## register

```bash
curl 'http://localhost:7005/api/register' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'DNT: 1' \
  -H 'Origin: http://localhost:7005' \
  -H 'Referer: http://localhost:7005/register' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"email":"xxx@xxx.com","password":"passwordpass","displayName":"xxx","termsAccepted":true,"cookiePolicyAccepted":true}'
```

# lookup

```bash
curl 'http://127.0.0.1:7002/identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyB3bUiVfOWkuJ8X0LAlFpT5xJitunVP6xg' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-GB,en-US;q=0.9,en;q=0.8' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'DNT: 1' \
  -H 'Origin: http://localhost:7005' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: cross-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' \
  -H 'X-Client-Version: Chrome/JsCore/12.0.0/FirebaseCore-web' \
  -H 'sec-ch-ua: "Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"idToken":"eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJuYW1lIjoieHh4IiwiZW1haWwiOiJ4eHhAeHh4LmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiYXV0aF90aW1lIjoxNzU4ODI5NDEyLCJ1c2VyX2lkIjoiQ3AzWmxtazRuQTZLN0dNTlV2bEpHZ3BaSXZ2cyIsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsieHh4QHh4eC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9LCJpYXQiOjE3NTg4Mjk0MTIsImV4cCI6MTc1ODgzMzAxMiwiYXVkIjoic3BsaXRpZnlkIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3NwbGl0aWZ5ZCIsInN1YiI6IkNwM1psbWs0bkE2SzdHTU5VdmxKR2dwWkl2dnMifQ."}'
```
