'use strict';


function getPassages(query_id, callback) {
    d3.json('data/passages/' + query_id + '.json', callback);
}

function createPassageView() {
    var selection = d3.select('#passages');

    return function(query) {
        getPassages(query.query_id, function(passages) {
            selection.selectAll('*').remove();

            var passageSelection = selection.selectAll('div.passage')
                .data(passages)
                .enter()
                .append('div')
                .attr('class', 'passage');

            passageSelection.append('a')
                .attr('class', 'passage-link')
                .attr('href', function(passage) { return passage.url; })
                .text(function(passage) { return passage.url; });

            passageSelection.append('p')
                .attr('class', 'passage-text')
                .text(function(passage) { return passage.passage_text; });
        });
    };
}

function onSearch(query) {
    console.log(query);
    getPassages(query.query_id, function(passages) {
        console.log(passages);
    });
}

function autocomplete(queries) {
    var MAX_RESULTS = 20;

    var updatePassageView = createPassageView();

    queries = queries.map(function(query) {
        return {
            label: query.query,
            value: query.query_id + 1, // for some reason JQuery doesn't like zero as a value
            type: query.query_type
        };
    });

    var searchBox = $('input#search');

    searchBox.focus();

    function updateSearchBoxValue(event, ui) {
        event.preventDefault();
        searchBox.val(ui.item.label);
    }

    searchBox.autocomplete({
        delay: 0,
        source: function(request, response) {
            response($.ui.autocomplete.filter(queries, request.term).slice(0, MAX_RESULTS));
        },
        select: function(event, ui) {
            var query = {
                query: ui.item.label,
                query_id: ui.item.value - 1,
                query_type: ui.item.type
            };
            updatePassageView(query);
            updateSearchBoxValue(event, ui);
        },
        change: updateSearchBoxValue,
        focus: updateSearchBoxValue
    });
}

(function() {
    d3.json('data/queries.json', function(queries) {
        autocomplete(queries);
    });
})();

