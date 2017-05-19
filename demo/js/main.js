'use strict';


function getAnswer(query_id, callback) {
    d3.json('data/answers/' + query_id + '.json', callback);
}

function createAnswerView() {
    var selection = d3.select('p#answer');

    return function(query, answer) {
        var passage = answer.passages
            .find(function(passage) { return passage.selected; });

        if (passage) {
            var answerText = passage.tokens
                .slice(passage.start_index, passage.end_index)
                .join(' ');

            selection.text(answerText);
        } else {
            console.error('no answer found', query, answer);
            selection.text('');
        }
    }
}

function cumSum(array) {
    var sum = [];

    array.reduce(function(a, b, i) {
        return sum[i] = a + b; 
    }, 0);

    return sum;
}

function sample(array) {
    return array[Math.floor(Math.random() * array.length)];
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
            .classed('selected', function(passage) { return passage.selected; });

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
                var pStart = cumSum(passage.logits_start);
                var pEnd = cumSum(passage.logits_end);
                var pIn = pStart.map(function(p, i) {
                    return p * (1 - pEnd[i]);
                });

                var colorScale = d3.scaleQuantize()
                    .domain(d3.extent(pIn))
                    .range(d3.schemeGreens[9].slice(0, 5));

                return passage.tokens.map(function(token, index) {
                    return {
                        token: token,
                        logitStart: passage.logits_start[index],
                        logitEnd: passage.logits_end[index],
                        color: colorScale(pIn[index])
                    };
                });
            })
            .enter()
            .append('span')
            .attr('class', 'token')
            .attr('logit-start', function(token) { return token.logitStart; })
            .attr('logit-end', function(token) { return token.logitEnd; })
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

        if (ui.item) {
            searchBox.val(ui.item.label);
        }
    }

    function selectQuestion(autocompleteQuery) {
        var query = {
            query: autocompleteQuery.label,
            query_id: autocompleteQuery.value - 1,
            query_type: autocompleteQuery.type
        };

        getAnswer(query.query_id, function(answer) {
            updatePassageView(query, answer);
            updateAnswerView(query, answer);
        });
    }

    searchBox.autocomplete({
        delay: 0,
        source: function(request, response) {
            response($.ui.autocomplete.filter(queries, request.term).slice(0, MAX_RESULTS));
        },
        select: function(event, ui) {
            selectQuestion(ui.item);
            updateSearchBoxValue(event, ui);
        },
        change: updateSearchBoxValue,
        focus: updateSearchBoxValue
    });

    d3.select('button#lucky').on('click', function() {
        var query = sample(queries);
        searchBox.val(query.label);
        selectQuestion(query);
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

