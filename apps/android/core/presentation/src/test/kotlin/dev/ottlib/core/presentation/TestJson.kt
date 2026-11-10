package dev.ottlib.core.presentation

/** JSON bodies the presentation tests serve from MockWebServer, shaped like the server's responses. */
internal object TestJson {
    fun listItem(id: Int, title: String = "Title $id", resumePositionMs: Long? = null, fresh: String? = null, showKey: String? = null) =
        """{"id":$id,"title":"$title","year":2000,"posterUrl":"/media/posters/$id.jpg","resolution":null,"hdrFormat":null,"watched":false,""" +
            """"resumePositionMs":${resumePositionMs ?: "null"},"durationMs":7200000,"missing":false,"metadataStatus":"matched","shelves":[],""" +
            """"showKey":${showKey?.let { "\"$it\"" }},"fresh":${fresh?.let { "\"$it\"" }}}"""

    fun page(vararg items: String) = """{"items":[${items.joinToString(",")}],"nextCursor":null,"total":${items.size}}"""

    fun movie(id: Int, overview: String? = "About $id", collectionId: Int? = null) =
        """{"id":$id,"title":"Title $id","year":2000,"rawFilename":"t$id.mkv","filePath":"/m/t$id.mkv","titleOverride":null,""" +
            """"overview":${overview?.let { "\"$it\"" }},"posterUrl":"/media/posters/$id.jpg","backdropUrl":"/media/backdrops/$id.jpg","genres":[],"cast":[],""" +
            """"rating":null,"runtime":120,"imdbId":null,"metadataStatus":"matched","metadataSource":null,"mediaType":"movie","season":null,"episode":null,""" +
            """"fileSizeBytes":1,"mediaInfo":null,"watched":false,"resumePositionMs":null,"missing":false,"addedAt":"2026-01-01T00:00:00Z","shelves":[],""" +
            """"ratings":[{"source":"imdb","value":8.8,"max":10},{"source":"rottenTomatoes","value":87,"max":100}],""" +
            """"castMembers":[{"name":"Sigourney Weaver","photoUrl":"/media/people/sw.jpg"},{"name":"Tom Skerritt","photoUrl":null}],""" +
            """"logoUrl":"/media/logos/$id.png","collection":${collectionId?.let { """{"id":$it,"name":"Saga"}""" }}}"""
}
