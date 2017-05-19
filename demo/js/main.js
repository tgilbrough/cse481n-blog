'use strict';


function getAnswer(query_id, callback) {
    d3.json('data/answers/' + query_id + '.json', callback);
}

function createAnswerView() {
    var selection = d3.select('p#answer');

    return function(query, answer) {
        var all_tokens = answer.passages[answer.passage_index].tokens;
        var tokens = all_tokens.slice(answer.start_index, answer.end_index);
        selection.text(tokens.join(' '));
    }
}

function createPassageView() {
    var selection = d3.select('div#passages');

    return function(query, answer) {
        var passages = answer.passages;

        selection.selectAll('*').remove();

        var passageSelection = selection.selectAll('div.passage')
            .data(passages)
            .enter()
            .append('div')
            .attr('class', 'passage')
            .classed('selected', function(passage, index) {
                return index === answer.passage_index;
            });

        var rankContainer = passageSelection.append('div')
            .attr('class', 'rank-container');

        rankContainer.append('div')
            .attr('class', 'rank-number')
            .text(function(passage, index) {
                return '#' + (index + 1);
            });

        rankContainer.append('p')
            .attr('class', 'relevance')
            .text('Relevance');

        rankContainer.append('p')
            .text(function(passage) {
                return passage.relevance.toFixed(3);
            });

        var passageContainer = passageSelection.append('div')
            .attr('class', 'passage-container');

        passageContainer.append('a')
            .attr('class', 'passage-link')
            .attr('href', function(passage) { return passage.url; })
            .text(function(passage) { return passage.url; });

        passageContainer.append('p')
            .attr('class', 'passage-text')
            .selectAll('span')
            .data(function(passage) {
                var logitScale = d3.scaleQuantize()
                    .domain(d3.extent(passage.logits_start))
                    .range(d3.schemeGreens[9].slice(0, 5));

                return passage.tokens.map(function(token, index) {
                    var logit = passage.logits_start[index];
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
            .attr('index', function(token, index) { return index; })
            .style('background-color', function(token) { return token.color; })
            .text(function(token) { return token.token; });
    };
}

function autocomplete(queries) {
    var MAX_RESULTS = 20;

    var updatePassageView = createPassageView();
    var updateAnswerView = createAnswerView();

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

            getAnswer(query.query_id, function(answer) {
                console.log(query);
                console.log(answer);
                updatePassageView(query, answer);
                updateAnswerView(query, answer);
            });

            updateSearchBoxValue(event, ui);
        },
        change: updateSearchBoxValue,
        focus: updateSearchBoxValue
    });
}

(function() {
    d3.json('data/queries.json', function(queries) {
        // Currently limited to location questions.
        queries = queries.filter(function(query) {
            return query.query_type == 'location';
        });

        autocomplete(queries);
    });
})();

