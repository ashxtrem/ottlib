package dev.ottlib.core.network

import kotlinx.serialization.json.Json

/** Runtime decoding is lenient so a newer server can add fields; ContractFixturesTest guards the shapes strictly. */
val OttlibJson: Json = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
}
