package dev.ottlib.core.network

import java.io.IOException

/** A non-2xx response from the Ottlib server. `message` is the server's `{ error }` text when present. */
class ApiException(val statusCode: Int, message: String) : IOException(message)
