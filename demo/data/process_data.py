
import json
import os


SOURCE_FILE = 'test_public_v1.1.json'
PASSAGE_DIR = 'passages'
QUERY_FILE = 'queries.json'


def load_json_lines(path):
    with open(path) as json_file:
        for line in json_file:
            yield json.loads(line)


def main():
    if not os.path.exists(PASSAGE_DIR):
        os.makedirs(PASSAGE_DIR)

    queries = []

    for q in load_json_lines(SOURCE_FILE):
        q_id = q['query_id']

        with open('{}/{}.json'.format(PASSAGE_DIR, q_id), 'w+') as out:
            json.dump(q['passages'], out)

        del(q['passages'])
        queries.append(q)

    with open(QUERY_FILE, 'w+') as out:
        json.dump(queries, out)


if __name__ == '__main__':
    main()
