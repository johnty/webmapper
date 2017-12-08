function SaverLoader(container, model) {
    this._container = container;
    this.model = model;
}

//<input type="checkbox" id="subscribeNews" name="subscribe" value="newsletter">
//<label for="subscribeNews">Subscribe to newsletter?</label>


SaverLoader.prototype = {
    // Initialize the Top Menu Bar Component
    init : function() {
        var _self = this;   // to pass to context of THIS to event handlers

        $(this._container).append(
            "<div id='saverLoaderDiv' class='topMenu' style='width:90px;'>"+
                "<div class='topMenuTitle'><strong>FILE</strong></div>"+
                "<div class='topMenuContainer'>"+
                    "<div><a id='saveButton'>Save</a><input id='saveAll' type='checkbox'></div>"+
                    "<div id='loadButton'>Open</div>"+

                "</div>"+
            "</div>");
    },
};
