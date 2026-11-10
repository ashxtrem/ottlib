package dev.ottlib.core.data

import dev.ottlib.core.model.ProfileSummary
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RecentSearchListsTest {
    private fun addAll(vararg queries: String, scope: String = "s"): Map<String, List<String>> =
        queries.fold(emptyMap()) { lists, query -> RecentSearchLists.add(lists, scope, query) }

    @Test
    fun keepsTheNewestEightFirst() {
        val lists = addAll("a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10")
        assertEquals(listOf("a10", "a9", "a8", "a7", "a6", "a5", "a4", "a3"), lists["s"])
    }

    @Test
    fun aRepeatInAnyCaseMovesToTheFrontWithoutDuplicating() {
        val lists = addAll("alien", "heat", "dune", "ALIEN")
        assertEquals(listOf("ALIEN", "dune", "heat"), lists["s"])
    }

    @Test
    fun removesCaseInsensitivelyAndDropsAnEmptyScope() {
        val lists = addAll("alien", "heat")
        assertEquals(listOf("heat"), RecentSearchLists.remove(lists, "s", "Alien")["s"])
        assertEquals(emptyMap<String, List<String>>(), RecentSearchLists.remove(addAll("alien"), "s", "alien"))
    }

    @Test
    fun scopesStayApart() {
        val lists = RecentSearchLists.add(addAll("alien", scope = "a"), "b", "heat")
        assertEquals(listOf("alien"), lists["a"])
        assertEquals(listOf("heat"), lists["b"])
        assertEquals(listOf("alien"), RecentSearchLists.remove(lists, "b", "heat")["a"])
    }

    @Test
    fun roundTripsAndIgnoresCorruptData() {
        val lists = addAll("alien", "heat")
        assertEquals(lists, RecentSearchLists.decode(RecentSearchLists.encode(lists)))
        assertEquals(emptyMap<String, List<String>>(), RecentSearchLists.decode("not json"))
        assertEquals(emptyMap<String, List<String>>(), RecentSearchLists.decode(null))
    }

    @Test
    fun buildsTheScopeFromServerAndProfile() {
        val server = "http://192.168.1.5:8080/".toHttpUrl()
        val other = "http://192.168.1.6:8080/".toHttpUrl()
        val kid = ProfileSummary(2, "Kid", "#fff", hasPin = false, isOwner = false)
        val state = ProfileState.Selected(kid, listOf(kid))

        assertEquals("192.168.1.5:8080/2", RecentSearchScope.of(server, state))
        assertEquals("192.168.1.5:8080/-", RecentSearchScope.of(server, ProfileState.Unsupported))
        assertEquals("192.168.1.6:8080/2", RecentSearchScope.of(other, state))
        assertNull(RecentSearchScope.of(null, state))
    }

    @Test
    fun aServerWithoutProfilesStillKeepsRecents() {
        val scope = RecentSearchScope.of("http://10.0.0.2:8080/".toHttpUrl(), ProfileState.Unsupported)!!
        assertEquals(listOf("alien"), RecentSearchLists.add(emptyMap(), scope, "alien")[scope])
    }
}
