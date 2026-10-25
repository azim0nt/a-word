import json
import re
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkinter import simpledialog
from pathlib import Path
from typing import Any

try:
    import json5
except ImportError as error:
    raise SystemExit(
        "Не найдена библиотека json5.\n"
        "Установи её командой: pip install json5"
    ) from error

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "vocab_data"
OUTPUT_FILE = BASE_DIR / "vocab.json"
WORD_FIELDS = ("word", "pos", "uz", "ru", "en", "example", "ex1", "ex2")


def normalize_vocab(data: Any) -> dict:
    """Normalize sections and word entries from supported vocabulary formats."""
    if not data or not isinstance(data, (dict, list)):
        raise ValueError("Словарь должен быть непустым объектом или списком модулей")

    field_aliases = {
        "word": "w",
        "example": "ex",
        "ex1": "e1",
        "ex2": "e2",
    }
    normalized = {}
    if isinstance(data, list):
        sections = []
        for section_index, section_data in enumerate(data, start=1):
            if not isinstance(section_data, dict):
                raise ValueError(
                    f"Раздел {section_index}: ожидался объект с полями "
                    "module и words"
                )
            section = section_data.get("module", f"Раздел {section_index}")
            sections.append((section, section_data.get("words")))
    else:
        sections = list(data.items())

    for section_index, (section, entries) in enumerate(sections, start=1):
        if not isinstance(section, str) or not section.strip():
            raise ValueError("Названия разделов словаря не могут быть пустыми")
        if isinstance(entries, dict):
            entries = entries.get("words")
        if not isinstance(entries, list):
            raise ValueError(
                f"Раздел «{section}» должен содержать список слов "
                "или объект с полем words"
            )

        output_section = f"p{section_index}"

        normalized_entries = []
        for index, entry in enumerate(entries, start=1):
            location = f"Раздел «{section}», запись {index}"
            if isinstance(entry, list):
                if len(entry) != len(WORD_FIELDS):
                    raise ValueError(
                        f"{location}: ожидалось {len(WORD_FIELDS)} значений, "
                        f"получено {len(entry)}"
                    )
                entry = dict(zip(WORD_FIELDS, entry))
            elif isinstance(entry, dict):
                entry = dict(entry)
                for field, alias in field_aliases.items():
                    if field not in entry and alias in entry:
                        entry[field] = entry[alias]
                    if alias != field:
                        entry.pop(alias, None)

                missing_fields = [
                    field for field in WORD_FIELDS if field not in entry
                ]
                if missing_fields:
                    raise ValueError(
                        f"{location}: отсутствуют поля "
                        f"{', '.join(missing_fields)}"
                    )
            else:
                raise ValueError(
                    f"{location}: ожидался объект или список из "
                    f"{len(WORD_FIELDS)} значений"
                )

            invalid_fields = [
                field for field in WORD_FIELDS
                if not isinstance(entry[field], str)
            ]
            if invalid_fields:
                raise ValueError(
                    f"{location}: поля должны содержать текст: "
                    f"{', '.join(invalid_fields)}"
                )
            normalized_entries.append(entry)

        normalized[output_section] = normalized_entries

    return normalized


def extract_vocab(source: str) -> dict:
    """Extract and parse the object assigned to VOCAB in JavaScript-like input."""
    match = re.search(r"\bVOCAB\s*=", source)
    if not match:
        try:
            result = json.loads(source)
        except json.JSONDecodeError:
            try:
                result = json5.loads(source)
            except (ValueError, TypeError) as error:
                raise ValueError(
                    "Вставь JSON/JavaScript-объект или объявление VOCAB = {...}"
                ) from error
        return normalize_vocab(result)

    start = source.find("{", match.end())
    if start == -1:
        raise ValueError("Не найдена открывающая скобка словаря")

    depth = 0
    quote = None
    escaped = False
    i = start

    while i < len(source):
        c = source[i]

        if quote:
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == quote:
                quote = None
        else:
            if source.startswith("//", i):
                end = source.find("\n", i)
                i = len(source) if end == -1 else end
                continue

            if source.startswith("/*", i):
                end = source.find("*/", i + 2)
                if end == -1:
                    raise ValueError("Незакрытый комментарий /* ... */")
                i = end + 2
                continue

            if c in ("'", '"', "`"):
                if c == "`":
                    raise ValueError(
                        "Шаблонные строки с обратными кавычками не поддерживаются. "
                        "Используй обычные одинарные или двойные кавычки."
                    )
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    raw = source[start:i + 1]
                    try:
                        result = json5.loads(raw)
                    except (ValueError, TypeError) as error:
                        raise ValueError(
                            f"Не удалось разобрать VOCAB: {error}"
                        ) from error

                    return normalize_vocab(result)

        i += 1

    raise ValueError("Не найдена закрывающая скобка словаря")


def module_sort_key(name):
    match = re.search(r"(\d+)$", name)
    if match:
        return (0, int(match.group(1)), name.lower())
    return (1, 0, name.lower())


def get_modules():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    modules = {}

    for folder in DATA_DIR.iterdir():
        if folder.is_dir():
            modules[folder.name] = {
                part: folder / f"{part}.json"
                for part in ("A", "B")
            }

    return modules


def rebuild_output():
    """Rebuild the combined JSON file from saved module/part files."""
    modules = get_modules()
    combined = {}

    for module in sorted(modules, key=module_sort_key):
        parts_data = {}

        for part in ("A", "B"):
            path = modules[module][part]
            if path.exists():
                try:
                    with path.open("r", encoding="utf-8") as file:
                        parts_data[part.lower()] = json.load(file)
                except (OSError, json.JSONDecodeError) as error:
                    raise ValueError(
                        f"Ошибка чтения сохранённого файла {path}: {error}"
                    ) from error

        if parts_data:
            combined[module] = parts_data

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(combined, file, ensure_ascii=False, indent=2)
        file.write("\n")


class VocabManager:
    BG = "#171321"
    PANEL = "#211b30"
    EDITOR_BG = "#100d18"
    FG = "#eee9ff"
    ACCENT = "#c4a7ff"
    SELECT = "#7650b8"

    def __init__(self, root):
        self.root = root
        self.root.title("VOCAB Manager")
        self.root.geometry("1050x720")
        self.root.minsize(800, 560)

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.module_var = tk.StringVar()
        self.part_var = tk.StringVar(value="A")
        self.status_var = tk.StringVar(value="Готов к работе.")
        self.build_ui()
        self.refresh_modules()

    def build_ui(self):
        self.root.configure(bg=self.BG)
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background=self.BG)
        style.configure(
            "TLabel", background=self.BG, foreground=self.FG,
            font=("Segoe UI", 10)
        )
        style.configure(
            "Header.TLabel", font=("Segoe UI", 20, "bold"),
            foreground=self.ACCENT
        )
        style.configure(
            "TButton", font=("Segoe UI", 10), padding=7
        )
        style.configure(
            "TCombobox", fieldbackground=self.PANEL,
            background=self.PANEL, foreground=self.FG, padding=5
        )

        main = ttk.Frame(self.root, padding=16)
        main.pack(fill="both", expand=True)

        ttk.Label(
            main, text="VOCAB MANAGER", style="Header.TLabel"
        ).pack(anchor="w")
        ttk.Label(
            main,
            text="Загружай части A и B. Модуль готов, когда сохранены обе части."
        ).pack(anchor="w", pady=(3, 14))

        content = ttk.Frame(main)
        content.pack(fill="both", expand=True)

        left = ttk.Frame(content)
        left.pack(side="left", fill="y", padx=(0, 16))

        ttk.Label(
            left, text="МОДУЛИ", font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 8))

        self.module_list = tk.Listbox(
            left, width=30, bg=self.PANEL, fg=self.FG,
            selectbackground=self.SELECT, selectforeground="white",
            relief="flat", font=("Segoe UI", 10),
            activestyle="none", exportselection=False
        )
        self.module_list.pack(fill="y", expand=True)
        self.module_list.bind("<<ListboxSelect>>", self.on_module_select)

        ttk.Button(
            left, text="+ Новый модуль", command=self.add_module
        ).pack(fill="x", pady=(10, 5))
        ttk.Button(
            left, text="Обновить список", command=self.refresh_modules
        ).pack(fill="x")

        right = ttk.Frame(content)
        right.pack(side="left", fill="both", expand=True)

        ttk.Label(
            right, text="ЗАГРУЗКА СЛОВАРЯ",
            font=("Segoe UI", 12, "bold")
        ).pack(anchor="w", pady=(0, 8))

        controls = ttk.Frame(right)
        controls.pack(fill="x", pady=(0, 8))

        ttk.Label(controls, text="Модуль:").pack(side="left")
        self.module_combo = ttk.Combobox(
            controls, textvariable=self.module_var,
            state="readonly", width=17
        )
        self.module_combo.pack(side="left", padx=(6, 14))
        self.module_combo.bind(
            "<<ComboboxSelected>>", self.on_combo_select
        )

        ttk.Label(controls, text="Часть:").pack(side="left")
        self.part_combo = ttk.Combobox(
            controls, textvariable=self.part_var,
            values=("A", "B"), state="readonly", width=5
        )
        self.part_combo.pack(side="left", padx=6)
        self.part_combo.bind(
            "<<ComboboxSelected>>", self.load_selected_part
        )

        source_actions = ttk.Frame(right)
        source_actions.pack(fill="x", pady=(0, 8))
        ttk.Button(
            source_actions, text="Вставить из буфера",
            command=self.paste_from_clipboard
        ).pack(side="left")
        ttk.Button(
            source_actions, text="Открыть .js / .json / .txt",
            command=self.open_file
        ).pack(side="left", padx=(8, 0))

        editor_frame = ttk.Frame(right)
        editor_frame.pack(fill="both", expand=True)

        self.editor = tk.Text(
            editor_frame, wrap="none", undo=True,
            bg=self.EDITOR_BG, fg="#e7dcff",
            insertbackground="white", selectbackground=self.SELECT,
            font=("Consolas", 10), relief="flat",
            padx=10, pady=10
        )
        yscroll = ttk.Scrollbar(
            editor_frame, orient="vertical", command=self.editor.yview
        )
        xscroll = ttk.Scrollbar(
            editor_frame, orient="horizontal", command=self.editor.xview
        )
        self.editor.configure(
            yscrollcommand=yscroll.set, xscrollcommand=xscroll.set
        )
        self.editor.grid(row=0, column=0, sticky="nsew")
        self.editor.bind("<Control-v>", self.paste_from_clipboard)
        self.editor.bind("<Control-V>", self.paste_from_clipboard)
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")
        editor_frame.rowconfigure(0, weight=1)
        editor_frame.columnconfigure(0, weight=1)

        actions = ttk.Frame(right)
        actions.pack(fill="x", pady=(10, 0))
        ttk.Button(
            actions, text="Сохранить часть", command=self.save_part
        ).pack(side="left")
        ttk.Button(
            actions, text="Очистить поле", command=self.clear_editor
        ).pack(side="left", padx=8)
        ttk.Button(
            actions, text="Открыть папку данных",
            command=self.open_data_folder
        ).pack(side="left")

        ttk.Label(
            main, textvariable=self.status_var
        ).pack(anchor="w", pady=(12, 0))

    def add_module(self):
        value = simpledialog.askstring(
            "Новый модуль",
            "Введи номер или название модуля:",
            parent=self.root
        )
        if not value or not value.strip():
            return

        value = value.strip()
        name = f"Module {value}" if value.isdigit() else value
        folder = DATA_DIR / name

        if folder.exists():
            messagebox.showinfo(
                "Модуль существует", f"{name} уже есть в списке."
            )
        else:
            folder.mkdir(parents=True, exist_ok=True)

        self.refresh_modules()
        self.module_var.set(name)
        self.select_module_in_list(name)
        self.load_selected_part()
        self.status_var.set(f"Выбран {name}.")

    def refresh_modules(self):
        modules = get_modules()
        if not modules:
            (DATA_DIR / "Module 1").mkdir(parents=True, exist_ok=True)
            modules = get_modules()

        names = sorted(modules, key=module_sort_key)
        selected_name = self.module_var.get()

        self.module_list.delete(0, tk.END)
        for name in names:
            files = modules[name]
            has_a = files["A"].exists()
            has_b = files["B"].exists()

            if has_a and has_b:
                status = "ГОТОВ"
            elif has_a or has_b:
                status = "НЕ ПОЛНЫЙ"
            else:
                status = "ПУСТО"

            self.module_list.insert(tk.END, f"{name}  [{status}]")

        self.module_combo["values"] = names
        if names:
            if selected_name not in names:
                selected_name = names[0]
            self.module_var.set(selected_name)
            self.select_module_in_list(selected_name)

    def select_module_in_list(self, name):
        for index in range(self.module_list.size()):
            label = self.module_list.get(index)
            if label.split("  [")[0] == name:
                self.module_list.selection_clear(0, tk.END)
                self.module_list.selection_set(index)
                self.module_list.activate(index)
                self.module_list.see(index)
                return

    def on_module_select(self, _event=None):
        selection = self.module_list.curselection()
        if not selection:
            return
        label = self.module_list.get(selection[0])
        name = label.split("  [")[0]
        self.module_var.set(name)
        self.load_selected_part()

    def on_combo_select(self, _event=None):
        self.select_module_in_list(self.module_var.get())
        self.load_selected_part()

    def load_selected_part(self, _event=None):
        name = self.module_var.get()
        part = self.part_var.get()
        if not name or part not in ("A", "B"):
            return

        path = DATA_DIR / name / f"{part}.json"
        self.editor.delete("1.0", tk.END)

        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                self.editor.insert(
                    "1.0", json.dumps(data, ensure_ascii=False, indent=2)
                )
                self.status_var.set(f"Загружена часть {part}: {name}")
            except (OSError, json.JSONDecodeError) as error:
                self.status_var.set(f"Ошибка чтения {path}: {error}")
        else:
            self.status_var.set(
                f"{name}, часть {part}: ещё не заполнена"
            )

    def open_file(self):
        path = filedialog.askopenfilename(
            parent=self.root,
            filetypes=[
                ("JavaScript / JSON / Text", "*.js *.json *.txt"),
                ("Все файлы", "*.*")
            ]
        )
        if not path:
            return

        try:
            content = Path(path).read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            messagebox.showerror("Ошибка открытия", str(error))
            return

        self.editor.delete("1.0", tk.END)
        self.editor.insert("1.0", content)
        self.status_var.set(f"Открыт файл: {path}")

    def paste_from_clipboard(self, _event=None):
        try:
            content = self.root.clipboard_get()
        except tk.TclError as error:
            messagebox.showwarning(
                "Буфер обмена",
                f"Не удалось прочитать текст из буфера обмена:\n{error}",
                parent=self.root
            )
            return "break"

        try:
            selection_start = self.editor.index("sel.first")
            selection_end = self.editor.index("sel.last")
        except tk.TclError:
            selection_start = selection_end = self.editor.index("insert")

        self.editor.delete(selection_start, selection_end)
        self.editor.insert(selection_start, content)
        self.status_var.set("Текст вставлен из буфера обмена.")
        return "break"

    def save_part(self):
        name = self.module_var.get()
        part = self.part_var.get()
        if not name:
            messagebox.showwarning("Нет модуля", "Сначала выбери модуль.")
            return

        source = self.editor.get("1.0", "end-1c").strip()
        if not source:
            messagebox.showwarning("Пустое поле", "Вставь словарь перед сохранением.")
            return

        try:
            vocab = extract_vocab(source)
        except ValueError as error:
            messagebox.showerror("Ошибка в словаре", str(error))
            return

        folder = DATA_DIR / name
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{part}.json"

        if path.exists():
            if not messagebox.askyesno(
                "Перезапись",
                f"{name}, часть {part} уже существует.\nЗаменить её?",
                parent=self.root
            ):
                return

        try:
            path.write_text(
                json.dumps(vocab, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8"
            )
            rebuild_output()
        except (OSError, ValueError) as error:
            messagebox.showerror("Ошибка сохранения", str(error))
            return

        self.refresh_modules()
        self.module_var.set(name)
        self.part_var.set(part)
        self.load_selected_part()

        modules = get_modules()
        has_a = modules[name]["A"].exists()
        has_b = modules[name]["B"].exists()

        if has_a and has_b:
            self.status_var.set(
                f"✓ {name} ГОТОВ — части A и B сохранены."
            )
            messagebox.showinfo(
                "Модуль готов!",
                f"{name}: части A и B заполнены.\n\n"
                f"Общий JSON обновлён:\n{OUTPUT_FILE.resolve()}",
                parent=self.root
            )
        else:
            missing = "B" if has_a else "A"
            self.status_var.set(
                f"✓ Часть {part} сохранена. "
                f"Для готовности осталось заполнить часть {missing}."
            )

    def clear_editor(self):
        if messagebox.askyesno(
            "Очистить поле",
            "Очистить редактор? Сохранённый JSON не удалится.",
            parent=self.root
        ):
            self.editor.delete("1.0", tk.END)
            self.status_var.set("Поле очищено; сохранённые файлы не изменены.")

    def open_data_folder(self):
        folder = DATA_DIR.resolve()
        try:
            import os
            import sys
            if sys.platform.startswith("win"):
                os.startfile(folder)
            elif sys.platform == "darwin":
                import subprocess
                subprocess.Popen(["open", str(folder)])
            else:
                import subprocess
                subprocess.Popen(["xdg-open", str(folder)])
        except Exception as error:
            messagebox.showerror("Ошибка", f"Не удалось открыть папку:\n{error}")


if __name__ == "__main__":
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    root = tk.Tk()
    app = VocabManager(root)
    root.mainloop()
