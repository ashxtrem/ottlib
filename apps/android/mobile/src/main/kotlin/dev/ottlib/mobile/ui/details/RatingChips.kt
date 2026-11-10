package dev.ottlib.mobile.ui.details

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.ottlib.core.model.OutsideRating
import dev.ottlib.core.presentation.ratingsLine
import dev.ottlib.core.presentation.theme.OttlibColors

/** Outside scores (IMDb, RT, MC) as small chips; sources the app does not know are skipped. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RatingChips(ratings: List<OutsideRating>) {
    val labels = ratings.map { listOf(it).ratingsLine() }.filter { it.isNotEmpty() }
    if (labels.isEmpty()) return
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        labels.forEach { label ->
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = OttlibColors.Foreground,
                modifier = Modifier.background(OttlibColors.SurfaceRaised, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
    }
}
