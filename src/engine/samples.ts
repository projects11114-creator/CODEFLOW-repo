import { SampleProgram } from './types.ts';

export const SAMPLE_PROGRAMS: SampleProgram[] = [
  // --- 8 MANDATORY DSA ALGORITHMS (ALL ACCEPT RUNTIME ARRAY INPUT VIA SCANNER) ---
  {
    id: 'dsa-bubble-sort',
    title: 'DSA: 1. Bubble Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, validates n > 0, performs adjacent element comparisons and swaps, and prints original and sorted arrays.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Bubble Sort', 'Adjacent Swaps', 'Sorted Output'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        // Bubble Sort: compare adjacent pairs and swap if out of order
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-selection-sort',
    title: 'DSA: 2. Selection Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, tracks minIndex in each pass, swaps the minimum into place, and displays the sorted array.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Selection Sort', 'minIndex tracking', 'In-place swap'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        // Selection Sort: find the minimum element in the remaining subarray
        for (int i = 0; i < n - 1; i++) {
            int minIdx = i;
            for (int j = i + 1; j < n; j++) {
                if (arr[j] < arr[minIdx]) {
                    minIdx = j;
                }
            }
            int temp = arr[minIdx];
            arr[minIdx] = arr[i];
            arr[i] = temp;
        }

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-insertion-sort',
    title: 'DSA: 3. Insertion Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, inserts each key into its correct position in the sorted prefix, and displays the sorted array.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Insertion Sort', 'Key shifting', 'Sorted prefix'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        // Insertion Sort: insert key into sorted prefix
        for (int i = 1; i < n; i++) {
            int key = arr[i];
            int j = i - 1;
            while (j >= 0 && arr[j] > key) {
                arr[j + 1] = arr[j];
                j = j - 1;
            }
            arr[j + 1] = key;
        }

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-merge-sort',
    title: 'DSA: 4. Merge Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, recursively divides the array and merges sorted halves with O(n log n) efficiency.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Merge Sort', 'Divide and conquer', 'Recursive merge'],
    code: `import java.util.Scanner;

public class Main {
    public static void merge(int[] arr, int l, int m, int r) {
        int n1 = m - l + 1;
        int n2 = r - m;
        int[] L = new int[n1];
        int[] R = new int[n2];

        for (int i = 0; i < n1; i++) {
            L[i] = arr[l + i];
        }
        for (int j = 0; j < n2; j++) {
            R[j] = arr[m + 1 + j];
        }

        int i = 0, j = 0, k = l;
        while (i < n1 && j < n2) {
            if (L[i] <= R[j]) {
                arr[k] = L[i];
                i++;
            } else {
                arr[k] = R[j];
                j++;
            }
            k++;
        }

        while (i < n1) {
            arr[k] = L[i];
            i++;
            k++;
        }
        while (j < n2) {
            arr[k] = R[j];
            j++;
            k++;
        }
    }

    public static void mergeSort(int[] arr, int l, int r) {
        if (l < r) {
            int m = l + (r - l) / 2;
            mergeSort(arr, l, m);
            mergeSort(arr, m + 1, r);
            merge(arr, l, m, r);
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        mergeSort(arr, 0, n - 1);

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-quick-sort',
    title: 'DSA: 5. Quick Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, partitions around a pivot, and recursively sorts left and right partitions.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Quick Sort', 'Pivot partition', 'Recursion'],
    code: `import java.util.Scanner;

public class Main {
    public static int partition(int[] arr, int low, int high) {
        int pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (arr[j] <= pivot) {
                i++;
                int temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
            }
        }
        int temp = arr[i + 1];
        arr[i + 1] = arr[high];
        arr[high] = temp;
        return i + 1;
    }

    public static void quickSort(int[] arr, int low, int high) {
        if (low < high) {
            int pi = partition(arr, low, high);
            quickSort(arr, low, pi - 1);
            quickSort(arr, pi + 1, high);
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        quickSort(arr, 0, n - 1);

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-heap-sort',
    title: 'DSA: 6. Heap Sort (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n and array elements via Scanner, builds a max-heap structure, and extracts elements in descending order to produce sorted output.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Heap Sort', 'Max Heap', 'Heapify'],
    code: `import java.util.Scanner;

public class Main {
    public static void heapify(int[] arr, int n, int i) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;

        if (left < n && arr[left] > arr[largest]) {
            largest = left;
        }
        if (right < n && arr[right] > arr[largest]) {
            largest = right;
        }
        if (largest != i) {
            int swap = arr[i];
            arr[i] = arr[largest];
            arr[largest] = swap;
            heapify(arr, n, largest);
        }
    }

    public static void heapSort(int[] arr, int n) {
        // Build max heap
        for (int i = n / 2 - 1; i >= 0; i--) {
            heapify(arr, n, i);
        }
        // Extract elements one by one from heap
        for (int i = n - 1; i > 0; i--) {
            int temp = arr[0];
            arr[0] = arr[i];
            arr[i] = temp;
            heapify(arr, i, 0);
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.println();
        System.out.println("Original array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        heapSort(arr, n);

        System.out.println();
        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();
    }
}`,
  },
  {
    id: 'dsa-linear-search',
    title: 'DSA: 7. Linear Search (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n, array elements, and a target value via Scanner. Iterates through the array and reports whether the target was found and its index/position.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Linear Search', 'Target matching', 'Index reporting'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        System.out.print("Enter target value to search for: ");
        int target = sc.nextInt();

        System.out.println();
        System.out.println("Array contents:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        int foundIndex = -1;
        for (int i = 0; i < n; i++) {
            if (arr[i] == target) {
                foundIndex = i;
                break;
            }
        }

        System.out.println();
        if (foundIndex != -1) {
            System.out.println("Target " + target + " found at index: " + foundIndex + " (Position: " + (foundIndex + 1) + ")");
        } else {
            System.out.println("Target " + target + " was not found in the array.");
        }
    }
}`,
  },
  {
    id: 'dsa-binary-search',
    title: 'DSA: 8. Binary Search (User Input & Dynamic Array)',
    category: 'Sorting & Searching',
    description: 'Reads n, array elements, and target value via Scanner. Explains that binary search requires a sorted array, sorts the user array, and performs divide-and-conquer search.',
    expectedConcepts: ['Scanner System.in', 'Dynamic int[] arr = new int[n]', 'Binary Search', 'Sorted precondition', 'log(n) search'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter number of elements: ");
        int n = sc.nextInt();
        if (n <= 0) {
            System.out.println("Invalid array size! Size must be positive.");
            return;
        }

        int[] arr = new int[n];
        System.out.println("Enter " + n + " elements:");
        for (int i = 0; i < n; i++) {
            arr[i] = sc.nextInt();
        }

        // Binary Search precondition: the array must be sorted.
        // We sort the user-entered array and clearly explain this behavior.
        System.out.println();
        System.out.println("Binary Search requires sorted elements. Sorting array before search...");
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }

        System.out.println("Sorted array:");
        for (int i = 0; i < n; i++) {
            System.out.print(arr[i] + " ");
        }
        System.out.println();

        System.out.print("Enter target value to search for: ");
        int target = sc.nextInt();

        int low = 0;
        int high = n - 1;
        int foundIndex = -1;

        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (arr[mid] == target) {
                foundIndex = mid;
                break;
            } else if (arr[mid] < target) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        System.out.println();
        if (foundIndex != -1) {
            System.out.println("Element found at position: " + (foundIndex + 1));
            System.out.println("Target " + target + " found at index: " + foundIndex + " (Position: " + (foundIndex + 1) + ")");
        } else {
            System.out.println("Element not found");
            System.out.println("Target " + target + " was not found in the sorted array.");
        }
    }
}`,
  },

  // --- CORE FOUNDATIONAL CONCEPTS ---
  {
    id: 'variable-reassignment',
    title: 'Basics: Variable Reassignment (marks 100 -> 150)',
    category: 'Basics',
    description: 'Declares marks = 100, then reassigns marks = 150, demonstrating 3D variable memory cell mutation.',
    expectedConcepts: ['Variable declaration', 'Reassignment', '3D Memory slot animation'],
    code: `public class Main {
    public static void main(String[] args) {
        int marks = 100;
        marks = 150;
        System.out.println("Final Marks: " + marks);
    }
}`,
  },
  {
    id: 'arithmetic-expressions',
    title: 'Basics: Arithmetic & Primitive Types',
    category: 'Basics',
    description: 'Calculates age, gpa, and next year predictions with multiple primitive types.',
    expectedConcepts: ['Arithmetic ops', 'Floating point', 'Type casting'],
    code: `public class Main {
    public static void main(String[] args) {
        int age = 20;
        double gpa = 3.85;
        int nextYearAge = age + 1;
        double honorThreshold = gpa + 0.10;
        System.out.println("Age next year: " + nextYearAge);
        System.out.println("Target GPA: " + honorThreshold);
    }
}`,
  },
  {
    id: 'if-else-conditions',
    title: 'Control Flow: If-Else Decision Branching',
    category: 'Control Flow',
    description: 'Evaluates conditional branches with decision path visualizer.',
    expectedConcepts: ['Decision logic', 'Conditional jump', 'Grade assignment'],
    code: `public class Main {
    public static void main(String[] args) {
        int score = 88;
        char grade;
        if (score >= 90) {
            grade = 'A';
        } else if (score >= 80) {
            grade = 'B';
        } else {
            grade = 'C';
        }
        System.out.println("Assigned Grade: " + grade);
    }
}`,
  },
  {
    id: 'for-while-loops',
    title: 'Loops: For & While Loops Accumulator',
    category: 'Loops',
    description: 'Tracks loop variables, iteration counters, and accumulator additions in 3D.',
    expectedConcepts: ['Loop header', 'Iteration monitoring', 'Accumulator pattern'],
    code: `public class Main {
    public static void main(String[] args) {
        int sum = 0;
        for (int i = 1; i <= 5; i++) {
            sum += i;
            System.out.println("i=" + i + ", running sum=" + sum);
        }
        System.out.println("Total Sum = " + sum);
    }
}`,
  },
  {
    id: '1d-2d-arrays',
    title: '2D Arrays: Grid Matrix Allocation',
    category: '2D Arrays',
    description: 'Allocates a 2D matrix in the Heap, visualizes multi-dimensional row/col index access and updates.',
    expectedConcepts: ['2D Matrix allocation', 'Planar grid cells', 'Row/Col index tracking'],
    code: `public class Main {
    public static void main(String[] args) {
        int[][] matrix = {
            { 10, 20, 30 },
            { 40, 50, 60 }
        };
        matrix[0][1] = 99;
        int val = matrix[0][1];
        System.out.println("Updated matrix[0][1] = " + val);
    }
}`,
  },
  {
    id: 'methods-params',
    title: 'Methods: Parameter Passing & Returns',
    category: 'Methods',
    description: 'Tracks call stack growth and parameter value binding across methods.',
    expectedConcepts: ['Call stack frames', 'Parameter binding', 'Return value propagation'],
    code: `public class Main {
    public static int calculateSquare(int num) {
        int result = num * num;
        return result;
    }

    public static void main(String[] args) {
        int value = 7;
        int squared = calculateSquare(value);
        System.out.println("Square of " + value + " is " + squared);
    }
}`,
  },
  {
    id: 'recursion-factorial',
    title: 'Recursion: Call-Stack Towers',
    category: 'Recursion',
    description: 'Visualizes recursive method call frames stacking vertically in 3D space and unwinding to return.',
    expectedConcepts: ['Recursive frames', 'Base case detection', 'Stack unwinding'],
    code: `public class Main {
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int result = factorial(4);
        System.out.println("Factorial of 4 = " + result);
    }
}`,
  },
  {
    id: 'objects-and-fields',
    title: 'OOP: Objects & Heap Field Changes',
    category: 'Objects & OOP',
    description: 'Instantiates a custom class in Heap memory, tracking references and live field mutations.',
    expectedConcepts: ['Custom class', 'Heap object creation', 'Field mutation in 3D'],
    code: `class Student {
    String name;
    int marks;
}

public class Main {
    public static void main(String[] args) {
        Student s = new Student();
        s.name = "Alex";
        s.marks = 85;
        s.marks = 95;
        System.out.println("Student: " + s.name + " (" + s.marks + ")");
    }
}`,
  },
  {
    id: 'interactive-scanner',
    title: 'Input: Scanner Interactive Console',
    category: 'Basics',
    description: 'Prompts interactively for input via JVM stdin, cleanly synchronized with the memory visualizer.',
    expectedConcepts: ['Scanner System.in', 'Interactive Console', 'Monotonic streaming'],
    code: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Enter name: ");
        String name = sc.nextLine();
        System.out.print("Enter age: ");
        int age = sc.nextInt();
        System.out.println("Name: " + name);
        System.out.println("Age: " + age);
    }
}`,
  },
  {
    id: 'exception-runtime',
    title: 'Exceptions: Division by Zero Detection',
    category: 'Exceptions',
    description: 'Captures and visualizes runtime division by zero or array bounds crash point.',
    expectedConcepts: ['ArithmeticException', 'Crash line highlight', 'Stack diagnostic'],
    code: `public class Main {
    public static void main(String[] args) {
        int a = 10;
        int b = 0;
        int c = a / b;
        System.out.println(c);
    }
}`,
  },
  {
    id: 'error-type-mismatch',
    title: 'Error Practice: Incompatible Types Fix',
    category: 'Error Practice',
    description: 'Incompatible types error with instant beginner explanation and automated repair.',
    expectedConcepts: ['Type checker', 'One-click fix', 'Error assistant'],
    code: `public class Main {
    public static void main(String[] args) {
        int username = "student";
        System.out.println(username);
    }
}`,
  },
];
