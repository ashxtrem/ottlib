package dev.ottlib.core.network

import java.io.IOException

/**
 * A non-2xx response from the Ottlib server. `message` is the server's `{ error }` text when present;
 * [errorCode] is the body's `error` when that is a code (`PROFILE_REQUIRED`), else null.
 */
class ApiException(val statusCode: Int, message: String, val errorCode: String? = null) : IOException(message)
