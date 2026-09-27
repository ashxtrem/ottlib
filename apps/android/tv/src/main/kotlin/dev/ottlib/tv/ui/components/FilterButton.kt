package dev.ottlib.tv.ui.components

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import dev.ottlib.tv.ui.theme.OttlibColors

/** A pill showing `Label: value`; opens a chooser when clicked. Highlighted when the filter is not at its default. */
@Composable
fun FilterButton(label: String, value: String, active: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = ClickableSurfaceDefaults.shape(RoundedCornerShape(50)),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (active) OttlibColors.AccentSoft else OttlibColors.Surface,
            contentColor = if (active) OttlibColors.Accent else OttlibColors.Foreground,
            focusedContainerColor = OttlibColors.Foreground,
            focusedContentColor = OttlibColors.Canvas,
        ),
        scale = ClickableSurfaceDefaults.scale(focusedScale = 1.05f),
    ) {
        Text("$label: $value", style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp))
    }
}
