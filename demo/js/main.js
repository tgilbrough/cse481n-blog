'use strict';


function getAnswer(query_id, callback) {
    d3.json('data/answers/' + query_id + '.json', callback);
}

function createPassageView() {
    var selection = d3.select('#passages');

    return function(query) {
        getAnswer(query.query_id, function(answer) {
            var passages = answer.passages;

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
                .selectAll('span')
                .data(function(passage) {
                    var logitScale = d3.scaleQuantize()
                        .domain(d3.extent(passage.logits))
                        .range(d3.schemeGreens[9].slice(0, 5));

                    return passage.tokens.map(function(token, index) {
                        var logit = passage.logits[index];
                        var color = d3.color(logitScale(logit));

                        return {
                            token: token,
                            logit: logit,
                            color: color.toString()
                        };
                    });
                })
                .enter()
                .append('span')
                .attr('class', 'token')
                .attr('logit', function(token) { return token.logit; })
                .style('background-color', function(token) { return token.color; })
                .text(function(token) { return token.token; });

        });
    };
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

