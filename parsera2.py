import json
import os
from bs4 import BeautifulSoup

def parse_a2_html_and_append(html_file_path, json_output_path):
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"Ошибка: файл {html_file_path} не найден!")
        return

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Загружаем существующие данные из words.json, если файл уже есть
    existing_data = []
    if os.path.exists(json_output_path):
        try:
            with open(json_output_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
        except json.JSONDecodeError:
            existing_data = []

    # Создаем словарь для удобного добавления/обновления по ключу модуля
    modules_dict = {item['module']: item for item in existing_data}

    # Ищем модули по новому атрибуту data-mod
    module_sections = soup.find_all('div', class_='module-section')
    new_modules_count = 0

    for section in module_sections:
        # Берем data-mod вместо data-module
        module_id = section.get('data-mod')
        if not module_id:
            # На случай, если где-то остался старый формат
            module_id = section.get('data-module', 'unknown')
        
        heading_el = section.find('div', class_='module-heading')
        module_title = heading_el.find('h2').get_text(strip=True) if heading_el else f"Module {module_id}"

        words_list = []
        cards = section.find_all('div', class_='vocab-card')

        for card in cards:
            # Английское слово
            word_el = card.find('div', class_='card-word')
            word = " ".join(word_el.get_text().split()) if word_el else ""

            # Новая структура переводов: через div.uz-word и div.ru-word
            uz_el = card.find('div', class_='uz-word')
            ru_el = card.find('div', class_='ru-word')
            
            uzbek = " ".join(uz_el.get_text().split()) if uz_el else ""
            russian = " ".join(ru_el.get_text().split()) if ru_el else ""

            if word:
                words_list.append({
                    "word": word,
                    "uzbek": uzbek,
                    "russian": russian
                })

        modules_dict[module_id] = {
            "module": module_id,
            "title": module_title,
            "words": words_list
        }
        new_modules_count += 1

    # Сохраняем обратно в список
    final_data = list(modules_dict.values())

    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=4)

    print(f"Успешно! Обработано модулей из A2: {new_modules_count}. Всего модулей в файле: {len(final_data)}")

# Запуск парсера
parse_a2_html_and_append("source.html", "A2.json")