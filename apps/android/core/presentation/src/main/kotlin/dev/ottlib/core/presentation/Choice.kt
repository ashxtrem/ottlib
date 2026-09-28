package dev.ottlib.core.presentation

/** One option in a single-choice list (filters, settings), shown as [label]. */
data class Choice<T>(val label: String, val value: T)
