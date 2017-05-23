
import json
import os
import random

import nltk


SOURCE_FILE = 'test_public_v1.1.json'
PASSAGE_DIR = 'passages'
ANSWER_DIR = 'answers'
QUERY_FILE = 'queries.json'


def load_json_lines(path):
    with open(path) as json_file:
        for line in json_file:
            yield json.loads(line)


def tokenize(string):
    return [token.replace("``", '"').replace("''", '"')
            for token in nltk.word_tokenize(string)]


def normalize(vector):
    _sum = sum(vector)
    return [x / _sum for x in vector]


def generate_answer(query):
    def generate_passage(passage):
        tokens = tokenize(passage['passage_text'])
        logits = normalize([random.random() for _ in tokens])
        return {
            'tokens': tokens,
            'logits': logits,
            'url': passage['url']
        }

    passages = [generate_passage(p) for p in query['passages']]
    relevance = normalize([random.random() for _ in passages])
    for i in range(len(passages)):
        passages[i]['relevance'] = relevance[i]
    passages.sort(key=lambda p: p['relevance'], reverse=True)
    selected_passage = passages[0]
    max_index = len(selected_passage['tokens']) - 1
    start_index = random.randint(0, max_index)
    end_index = random.randint(start_index, max_index)
    return {
        'query_id': query['query_id'],
        'passage_index': 0,  # passages sorted in descending order by relevance
        'start_index': start_index,
        'end_index': end_index,
        'passages': passages
    }


def main():
    if not os.path.exists(PASSAGE_DIR):
        os.makedirs(PASSAGE_DIR)

    if not os.path.exists(ANSWER_DIR):
        os.makedirs(ANSWER_DIR)

    queries = []

    for q in load_json_lines(SOURCE_FILE):
        q_id = q['query_id']

        with open('{}/{}.json'.format(PASSAGE_DIR, q_id), 'w+') as out:
            json.dump(q['passages'], out)

        with open('{}/{}.json'.format(ANSWER_DIR, q_id), 'w+') as out:
            json.dump(generate_answer(q), out)

        del(q['passages'])
        queries.append(q)

    with open(QUERY_FILE, 'w+') as out:
        json.dump(queries, out)


if __name__ == '__main__':
    main()
