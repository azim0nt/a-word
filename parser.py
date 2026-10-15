import json
import os
from bs4 import BeautifulSoup

def parse_and_append_html(html_file_path, json_output_path):
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

    # Превращаем в словарь для удобного обновления по ключу модуля (например, "1a", "2a")
    # Если модуль уже был — мы обновим его слова, если новый — добавим
    modules_dict = {item['module']: item for item in existing_data}

    # Находим все секции модулей в свежем HTML
    module_sections = soup.find_all('div', class_='module-section')
    new_modules_count = 0

    for section in module_sections:
        module_id = section.get('data-module')
        
        heading_el = section.find('div', class_='module-heading')
        module_title = heading_el.find('h2').get_text(strip=True) if heading_el else f"Module {module_id}"

        words_list = []
        cards = section.find_all('div', class_='vocab-card')

        for card in cards:
            word_el = card.find('div', class_='card-word')
            word = " ".join(word_el.get_text().split()) if word_el else ""

            uz_part = card.find('span', class_='uz-part')
            ru_part = card.find('span', class_='ru-part')
            
            uzbek = " ".join(uz_part.get_text().split()) if uz_part else ""
            russian = " ".join(ru_part.get_text().split()) if ru_part else ""

            if word:
                words_list.append({
                    "word": word,
                    "uzbek": uzbek,
                    "russian": russian
                })

        # Добавляем или обновляем модуль в нашем словаре
        modules_dict[module_id] = {
            "module": module_id,
            "title": module_title,
            "words": words_list
        }
        new_modules_count += 1

    # Переводим обратно в список (сохраняя порядок)
    final_data = list(modules_dict.values())

    # Сохраняем итоговый массив в JSON
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=4)

    print(f"Успешно! Обработано модулей из HTML: {new_modules_count}. Всего модулей в файле {json_output_path}: {len(final_data)}")

# Запуск скрипта
parse_and_append_html("source.html", "A2.json")