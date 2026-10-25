import argparse
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, Tag


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = BASE_DIR / "10module_a.html"


def clean_text(value: str) -> str:
    return " ".join(value.split())


def element_text(element: Tag | None) -> str:
    return clean_text(element.get_text(" ", strip=True)) if element else ""


def box_text(card: Tag, label: str) -> str:
    for box in card.select(".box"):
        label_element = box.select_one(".box-label")
        box_label = element_text(label_element).casefold()
        if box_label == label.casefold():
            text = (
                string
                for string in box.find_all(string=True)
                if label_element is None or label_element not in string.parents
            )
            return clean_text(" ".join(text))
    return ""


def parse_vocabulary_html(html_content: str) -> dict[str, list[dict[str, str]]]:
    soup = BeautifulSoup(html_content, "html.parser")
    sections = soup.select(".module-section")
    if not sections:
        raise ValueError("В HTML не найдены секции .module-section")

    result = {}
    for section_index, section in enumerate(sections, start=1):
        cards = section.select(
            ".card[data-word], .vcard[data-word], .vocab-card"
        )
        if not cards:
            raise ValueError(f"В секции {section_index} не найдены карточки слов")

        words = []
        for card_index, card in enumerate(cards, start=1):
            word = clean_text(card.get("data-word", "")) or element_text(
                card.select_one(".card-word")
            )
            entry = {
                "word": word,
                "pos": element_text(card.select_one(".card-pos")),
                "uz": clean_text(card.get("data-uzbek", ""))
                or clean_text(card.get("data-uz", ""))
                or element_text(card.select_one(".uz-text, .uz-word"))
                or element_text(card.select_one(".box-uz strong")),
                "ru": clean_text(card.get("data-russian", ""))
                or clean_text(card.get("data-ru", ""))
                or element_text(card.select_one(".ru-text, .ru-word"))
                or element_text(card.select_one(".box-uz em")),
                "en": clean_text(card.get("data-explanation", ""))
                or clean_text(card.get("data-en", ""))
                or element_text(
                    card.select_one(".box-blue .box-content, .en-text")
                )
                or box_text(card, "💡 ENGLISH EXPLANATION"),
                "example": element_text(
                    card.select_one(".example-text")
                )
                or box_text(card, "★ EXAMPLE SENTENCE"),
                "ex1": box_text(card, "Ex 1"),
                "ex2": box_text(card, "Ex 2"),
            }
            missing_fields = [field for field, value in entry.items() if not value]
            if missing_fields:
                raise ValueError(
                    f"Карточка {card_index} в секции {section_index} "
                    f"({word or 'без слова'}): отсутствуют поля "
                    f"{', '.join(missing_fields)}"
                )
            words.append(entry)

        result[f"p{section_index}"] = words

    return result


def parse_vocabulary_json(json_content: str) -> dict[str, list[dict[str, str]]]:
    try:
        source = json.loads(json_content)
    except json.JSONDecodeError as error:
        raise ValueError(f"Некорректный JSON: {error}") from error

    if not isinstance(source, dict) or not source:
        raise ValueError("Ожидался непустой объект разделов словаря")

    field_aliases = {
        "word": "word",
        "pos": "pos",
        "uz": "uz",
        "ru": "ru",
        "en": "en",
        "ex": "example",
        "e1": "ex1",
        "e2": "ex2",
    }
    result = {}
    for section_index, (section_id, section) in enumerate(source.items(), start=1):
        location = f"Раздел «{section_id}»"
        if not isinstance(section, dict):
            raise ValueError(f"{location}: ожидался объект с полем words")

        entries = section.get("words")
        if not isinstance(entries, list) or not entries:
            raise ValueError(f"{location}: поле words должно быть непустым списком")

        words = []
        for word_index, entry in enumerate(entries, start=1):
            word_location = f"{location}, запись {word_index}"
            if not isinstance(entry, dict):
                raise ValueError(f"{word_location}: ожидался объект слова")

            missing_fields = [
                field for field in field_aliases if field not in entry
            ]
            if missing_fields:
                raise ValueError(
                    f"{word_location}: отсутствуют поля "
                    f"{', '.join(missing_fields)}"
                )

            invalid_fields = [
                field
                for field in field_aliases
                if not isinstance(entry[field], str) or not entry[field].strip()
            ]
            if invalid_fields:
                raise ValueError(
                    f"{word_location}: пустые или нестроковые поля "
                    f"{', '.join(invalid_fields)}"
                )

            words.append({
                output_field: clean_text(entry[input_field])
                for input_field, output_field in field_aliases.items()
            })

        result[f"p{section_index}"] = words

    return result


def infer_output_path(source_content: str) -> Path:
    try:
        source = json.loads(source_content)
    except json.JSONDecodeError:
        source = None

    if isinstance(source, dict):
        labels = [
            f"{section_id} {section.get('label', '')}"
            for section_id, section in source.items()
            if isinstance(section, dict)
        ]
    else:
        soup = BeautifulSoup(source_content, "html.parser")
        labels = [
            element_text(heading)
            for heading in soup.select(".module-heading, .module-heading h2")
        ]

    module_parts = set()
    for label in labels:
        match = re.search(
            r"\bmodule\s+(\d+)\s*([ab])\b",
            label,
            re.IGNORECASE,
        )
        if not match:
            match = re.match(
                r"\s*(\d+)\s*([ab])(?:\b|[-_]|$)",
                label,
                re.IGNORECASE,
            )
        if match:
            module_parts.add((int(match.group(1)), match.group(2).upper()))

    if len(module_parts) != 1:
        raise ValueError(
            "Не удалось однозначно определить модуль и часть по источнику. "
            "Укажи путь к JSON явно вторым аргументом."
        )

    module_number, part = module_parts.pop()
    return BASE_DIR / "vocab_data" / f"Module {module_number}" / f"{part}.json"


def main() -> None:
    argument_parser = argparse.ArgumentParser(
        description="Преобразует HTML или JSON-словарь в формат vocab_data."
    )
    argument_parser.add_argument(
        "source_file",
        nargs="?",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Исходный HTML, JSON или TXT (по умолчанию: {DEFAULT_INPUT})",
    )
    argument_parser.add_argument(
        "json_file",
        nargs="?",
        type=Path,
        help="Выходной JSON (по умолчанию определяется по названию модуля)",
    )
    args = argument_parser.parse_args()

    try:
        source_content = args.source_file.read_text(encoding="utf-8")
        if source_content.lstrip().startswith("{"):
            vocabulary = parse_vocabulary_json(source_content)
        else:
            vocabulary = parse_vocabulary_html(source_content)
        output_path = args.json_file or infer_output_path(source_content)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(vocabulary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    except (OSError, ValueError) as error:
        argument_parser.error(str(error))

    total_words = sum(len(words) for words in vocabulary.values())
    print(f"Сохранено {total_words} слов в {output_path}")


if __name__ == "__main__":
    main()
